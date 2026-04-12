import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processIncomingMessage, identifyClient } from '@/lib/whatsapp/receive-message';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { formatOrderSummary } from '@/lib/whatsapp/format-summary';
import { parseSheinaExcel } from '@/lib/excel/sheina-parser';
import { parseExcelWithAI } from '@/lib/ai/claude-client';
import { createOrderEvent } from '@/lib/orders/events';
import { isWithinCutoff } from '@/lib/orders/cutoff';
import { createSupabaseAdmin } from '@/lib/supabase/server';

/**
 * Valida la firma de Twilio para seguridad del webhook.
 */
function validateTwilioSignature(request: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;

  const url = request.url;
  const params = new URLSearchParams(body);
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join('');

  const expected = Buffer.from(
    crypto.createHmac('sha1', authToken).update(url + sortedParams).digest('base64')
  );
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    // Log de entrada detallado
    const _p = new URLSearchParams(bodyText);
    const incomingFrom = _p.get('From') ?? '';
    const incomingBody = _p.get('Body') ?? '';
    const incomingNumMedia = _p.get('NumMedia') ?? '0';
    const incomingMediaType = _p.get('MediaContentType0') ?? null;
    console.log('WEBHOOK INCOMING:', JSON.stringify({
      from: incomingFrom,
      body: incomingBody.slice(0, 120),
      numMedia: incomingNumMedia,
      mediaType: incomingMediaType,
      hasMedia: incomingNumMedia !== '0',
    }));

    // Log pre-validación de firma
    const hasSignature = !!request.headers.get('x-twilio-signature');
    const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
    console.log('WEBHOOK SIGNATURE CHECK:', JSON.stringify({
      hasSignature,
      hasAuthToken,
      url: request.url,
      signatureValue: request.headers.get('x-twilio-signature')?.slice(0, 20) + '...',
    }));

    // Validar firma de Twilio (siempre, en todos los entornos)
    if (!validateTwilioSignature(request, bodyText)) {
      console.error('WEBHOOK SIGNATURE FAILED:', JSON.stringify({
        reason: !hasSignature ? 'missing x-twilio-signature header' : !hasAuthToken ? 'missing TWILIO_AUTH_TOKEN env var' : 'signature mismatch',
        url: request.url,
        hasSignature,
        hasAuthToken,
      }));
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Parsear el body URL-encoded
    const params = new URLSearchParams(bodyText);
    const webhookBody = {
      From: params.get('From') ?? '',
      Body: params.get('Body') ?? '',
      NumMedia: params.get('NumMedia') ?? '0',
      MediaUrl0: params.get('MediaUrl0') ?? undefined,
      MediaContentType0: params.get('MediaContentType0') ?? undefined,
    };

    const message = processIncomingMessage(webhookBody);
    const supabase = await createSupabaseAdmin();

    switch (message.action) {
      case 'PROCESS_EXCEL': {
        // Enviar confirmación inmediata (respetar timeout de 15s de Twilio)
        await sendWhatsAppMessage(message.phone, '📥 Recibí tu archivo. Estoy procesándolo...');

        try {
          // Descargar archivo desde Twilio
          const fileRes = await fetch(message.mediaUrl!, {
            headers: {
              'Authorization': `Basic ${Buffer.from(
                `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
              ).toString('base64')}`,
            },
          });
          const buffer = Buffer.from(await fileRes.arrayBuffer());

          // Parsear Excel
          const parseResult = await parseSheinaExcel(buffer);
          if (parseResult.errors.length > 0) {
            await sendWhatsAppMessage(
              message.phone,
              `❌ No pude leer el Excel:\n${parseResult.errors.join('\n')}\n\nPor favor verificá el archivo y envialo de nuevo.`
            );
            break;
          }

          // Validar con IA
          const validatedData = await parseExcelWithAI(parseResult);

          // Identificar cliente
          const client = await identifyClient(message.phone);
          if (!client || !client.organization_id) {
            await sendWhatsAppMessage(
              message.phone,
              '⚠️ No encontré tu cuenta asociada a este número. Contactá a Sheina para registrarte.'
            );
            break;
          }

          // Buscar el menú semanal publicado que corresponda al week_label
          // El weekLabel tiene formato "Semana del DD al DD de mes" o similar;
          // se busca por la primera fecha del rango de días parseados.
          const firstDay = validatedData.days[0];
          let menuId: string | null = null;
          if (firstDay) {
            // Derivar una fecha aproximada desde el weekLabel usando el día actual como ancla
            // La búsqueda amplia por published es suficiente — se toma el más reciente
            const { data: matchingMenu } = await supabase
              .from('weekly_menus')
              .select('id, week_start, week_end')
              .eq('status', 'published')
              .order('week_start', { ascending: false })
              .limit(5);

            if (matchingMenu && matchingMenu.length > 0) {
              // Preferir el menú cuyo week_label coincida textualmente o esté vigente
              const today = new Date().toISOString().slice(0, 10);
              const current = matchingMenu.find(
                (m) => m.week_start <= today && m.week_end >= today
              );
              menuId = (current ?? matchingMenu[0]).id;
            }
          }

          // Crear pedido
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              organization_id: client.organization_id,
              menu_id: menuId,
              week_label: validatedData.weekLabel,
              status: 'draft',
              source: 'whatsapp_excel',
              total_units: validatedData.totalUnits,
              ai_parsing_log: validatedData as unknown as Record<string, unknown>,
            })
            .select()
            .single();

          if (orderError || !order) {
            throw new Error(`Error creando pedido: ${orderError?.message}`);
          }

          // Crear líneas de pedido
          const lines = validatedData.days.flatMap((day) =>
            day.options.flatMap((opt) =>
              Object.entries(opt.departments).map(([dept, qty]) => ({
                order_id: order.id,
                day_of_week: day.dayOfWeek,
                department: dept,
                quantity: qty,
                unit_price: 0,
                option_code: opt.code,
                display_name: opt.displayName,
              }))
            )
          );

          if (lines.length > 0) {
            await supabase.from('order_lines').insert(lines);
          }

          // Subir Excel original a Supabase Storage
          let originalFileUrl: string | null = null;
          try {
            const storagePath = `${client.organization_id}/${order.id}/original.xlsx`;
            const { error: uploadError } = await supabase.storage
              .from('order-files')
              .upload(storagePath, buffer, {
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                upsert: true,
              });

            if (!uploadError) {
              const { data: urlData, error: signErr } = await supabase.storage
                .from('order-files')
                .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

              if (signErr) {
                console.error('Error firmando URL:', signErr);
              } else {
                originalFileUrl = urlData.signedUrl;
                await supabase
                  .from('orders')
                  .update({ original_file_url: originalFileUrl })
                  .eq('id', order.id);
              }
            } else {
              console.error('Error subiendo Excel a Storage:', uploadError);
            }
          } catch (storageErr) {
            // No interrumpir el flujo si falla el upload
            console.error('Error en Storage upload:', storageErr);
          }

          // Evento de auditoría
          await createOrderEvent({
            orderId: order.id,
            eventType: 'created',
            actorId: client.id,
            actorRole: 'client',
            payload: { source: 'whatsapp_excel', totalUnits: validatedData.totalUnits },
          });

          // Enviar resumen
          const summary = formatOrderSummary(validatedData);
          await sendWhatsAppMessage(message.phone, summary);
        } catch (error) {
          const e = error instanceof Error ? error : new Error(String(error));
          console.error('WEBHOOK ERROR PROCESS_EXCEL:', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
          await sendWhatsAppMessage(
            message.phone,
            '❌ Hubo un error al procesar tu archivo. Intentá de nuevo o contactá a Sheina.'
          );
        }
        break;
      }

      case 'CONFIRM_ORDER': {
        try {
          const client = await identifyClient(message.phone);
          if (!client) {
            await sendWhatsAppMessage(message.phone, '⚠️ No encontré tu cuenta asociada a este número. Contactá a Sheina para registrarte.');
            break;
          }

          // Buscar último pedido draft del cliente
          const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('organization_id', client.organization_id)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!order) {
            await sendWhatsAppMessage(message.phone, 'No encontré un pedido pendiente de confirmación.');
            break;
          }

          await supabase
            .from('orders')
            .update({
              status: 'confirmed' as const,
              confirmed_at: new Date().toISOString(),
              confirmed_by: client.id,
            })
            .eq('id', order.id);

          await createOrderEvent({
            orderId: order.id,
            eventType: 'confirmed',
            actorId: client.id,
            actorRole: 'client',
          });

          await sendWhatsAppMessage(
            message.phone,
            `✅ ¡Pedido confirmado!\nTotal: ${order.total_units} viandas — ${order.week_label}\n\nSi necesitás hacer cambios antes del corte, enviá un nuevo Excel.`
          );
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('WEBHOOK ERROR CONFIRM_ORDER:', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
        }
        break;
      }

      case 'CANCEL_ORDER': {
        try {
          const client = await identifyClient(message.phone);
          if (!client) {
            await sendWhatsAppMessage(message.phone, '⚠️ No encontré tu cuenta asociada a este número. Contactá a Sheina para registrarte.');
            break;
          }

          // Buscar último pedido draft o confirmed
          const { data: order } = await supabase
            .from('orders')
            .select('*, menu:weekly_menus(*)')
            .eq('organization_id', client.organization_id)
            .in('status', ['draft', 'confirmed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!order) {
            await sendWhatsAppMessage(message.phone, 'No encontré un pedido activo para cancelar.');
            break;
          }

          // Si está confirmado, verificar ventana de corte
          if (order.status === 'confirmed') {
            const { data: org } = await supabase
              .from('organizations')
              .select('cutoff_time, cutoff_days_before')
              .eq('id', client.organization_id)
              .single();

            if (org && !isWithinCutoff(order, order.menu, org)) {
              await sendWhatsAppMessage(
                message.phone,
                '⚠️ Ya pasó el horario de corte. Contactá a Sheina para modificar tu pedido.'
              );
              break;
            }
          }

          await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', order.id);

          await createOrderEvent({
            orderId: order.id,
            eventType: 'cancelled',
            actorId: client.id,
            actorRole: 'client',
          });

          await sendWhatsAppMessage(
            message.phone,
            `🚫 Pedido cancelado — ${order.week_label}\n\nSi querés hacer un nuevo pedido, enviame el Excel.`
          );
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('WEBHOOK ERROR CANCEL_ORDER:', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
        }
        break;
      }

      case 'HELP': {
        try {
          const client = await identifyClient(message.phone);
          console.log('WEBHOOK HELP identifyClient:', JSON.stringify({ phone: message.phone, found: !!client, organizationId: client?.organization_id ?? null }));

          if (!client) {
            await sendWhatsAppMessage(
              message.phone,
              `⚠️ Tu número *${message.phone}* no está registrado en el sistema de Grupo Sheina.\n\nContactá a Sheina para que te den de alta.`
            );
          } else {
            await sendWhatsAppMessage(
              message.phone,
              `👋 ¡Hola${client.full_name ? `, ${client.full_name.split(' ')[0]}` : ''}! Soy el asistente de *Grupo Sheina*.\n\nPodés:\n📎 *Enviar tu Excel* de pedidos y lo proceso automáticamente\n✅ Responder *confirmo* para confirmar un pedido\n❌ Responder *cancelar* para anular un pedido\n\n¿En qué te puedo ayudar?`
            );
          }
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('WEBHOOK ERROR HELP:', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
        }
        break;
      }
    }

    // Responder 200 OK a Twilio (TwiML vacío)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('WEBHOOK UNHANDLED ERROR:', JSON.stringify({ message: err.message, stack: err.stack, name: err.name }));
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
