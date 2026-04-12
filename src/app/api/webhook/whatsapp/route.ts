import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { processIncomingMessage, identifyClient } from '@/lib/whatsapp/receive-message';
import { sendWhatsAppMessage, sendLongWhatsAppMessage } from '@/lib/whatsapp/send-message';
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

/**
 * Procesa el Excel en background (después de retornar 200 a Twilio).
 * Se invoca via after() para no bloquear la respuesta.
 */
async function processExcelBackground(phone: string, mediaUrl: string) {
  try {
    console.log('EXCEL: downloading from URL...');
    const fileRes = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    });
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    console.log('EXCEL: downloaded, size =', buffer.length, 'bytes');

    console.log('EXCEL: parsing with sheina-parser...');
    const parseResult = await parseSheinaExcel(buffer);
    console.log('EXCEL: parsed,', parseResult.errors.length, 'errors,', parseResult.weeks?.length ?? 0, 'weeks');

    if (parseResult.errors.length > 0) {
      await sendWhatsAppMessage(
        phone,
        `❌ No pude leer el Excel:\n${parseResult.errors.join('\n')}\n\nPor favor verificá el archivo y envialo de nuevo.`
      );
      return;
    }

    console.log('EXCEL: calling Claude API...');
    const validatedData = await parseExcelWithAI(parseResult);
    console.log('EXCEL: Claude response received, weekLabel =', validatedData.weekLabel, 'totalUnits =', validatedData.totalUnits);

    console.log('EXCEL: identifying client for phone', phone);
    const client = await identifyClient(phone);
    console.log('EXCEL: client =', client?.id ?? 'NOT FOUND');

    if (!client || !client.organization_id) {
      await sendWhatsAppMessage(
        phone,
        '⚠️ No encontré tu cuenta asociada a este número. Contactá a Sheina para registrarte.'
      );
      return;
    }

    console.log('EXCEL: creating order in DB...');
    const supabase = await createSupabaseAdmin();

    // Buscar menú publicado vigente
    const { data: matchingMenu } = await supabase
      .from('weekly_menus')
      .select('id, week_start, week_end')
      .eq('status', 'published')
      .order('week_start', { ascending: false })
      .limit(5);

    let menuId: string | null = null;
    if (matchingMenu && matchingMenu.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const current = matchingMenu.find((m) => m.week_start <= today && m.week_end >= today);
      menuId = (current ?? matchingMenu[0]).id;
    }

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
    console.log('EXCEL: order created, id =', order.id);

    // Líneas de pedido
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
      console.log('EXCEL:', lines.length, 'order lines created');
    }

    // Subir Excel a Storage (no bloquea si falla)
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

        if (!signErr && urlData) {
          await supabase
            .from('orders')
            .update({ original_file_url: urlData.signedUrl })
            .eq('id', order.id);
        }
      }
    } catch (storageErr) {
      console.error('EXCEL: storage upload error (non-fatal):', storageErr);
    }

    // Evento de auditoría
    await createOrderEvent({
      orderId: order.id,
      eventType: 'created',
      actorId: client.id,
      actorRole: 'client',
      payload: { source: 'whatsapp_excel', totalUnits: validatedData.totalUnits },
    });

    // Enviar resumen (splitting automático si supera 1,500 chars)
    console.log('EXCEL: order created, sending summary...');
    const summary = formatOrderSummary(validatedData);
    console.log('EXCEL: summary length =', summary.length, 'chars');
    const sids = await sendLongWhatsAppMessage(phone, summary);
    console.log('EXCEL: summary sent,', sids.length, 'message(s):', sids.join(', '));
  } catch (error) {
    const errorDetail = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('EXCEL PROCESS FAILED:', errorDetail, errorStack);
    try {
      await sendWhatsAppMessage(phone, `❌ Error procesando Excel: ${errorDetail.substring(0, 200)}`);
    } catch {
      // ignorar error al enviar el mensaje de error
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    // STEP 1 — body parsed
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
    console.log('STEP 1: body parsed');

    // STEP 2 — signature check
    const hasSignature = !!request.headers.get('x-twilio-signature');
    const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
    console.log('WEBHOOK SIGNATURE CHECK:', JSON.stringify({
      hasSignature,
      hasAuthToken,
      url: request.url,
      signatureValue: request.headers.get('x-twilio-signature')?.slice(0, 20) + '...',
    }));

    if (!validateTwilioSignature(request, bodyText)) {
      console.error('WEBHOOK SIGNATURE FAILED:', JSON.stringify({
        reason: !hasSignature ? 'missing x-twilio-signature header' : !hasAuthToken ? 'missing TWILIO_AUTH_TOKEN env var' : 'signature mismatch',
        url: request.url,
        hasSignature,
        hasAuthToken,
      }));
      return new NextResponse('Forbidden', { status: 403 });
    }
    console.log('STEP 2: signature validated');

    // STEP 3 — parse message and determine action
    const params = new URLSearchParams(bodyText);
    const webhookBody = {
      From: params.get('From') ?? '',
      Body: params.get('Body') ?? '',
      NumMedia: params.get('NumMedia') ?? '0',
      MediaUrl0: params.get('MediaUrl0') ?? undefined,
      MediaContentType0: params.get('MediaContentType0') ?? undefined,
    };

    const message = processIncomingMessage(webhookBody);
    console.log('STEP 3: message type =', message.action, '| phone =', message.phone);

    const supabase = await createSupabaseAdmin();

    switch (message.action) {
      case 'PROCESS_EXCEL': {
        // Enviar ACK inmediato para cumplir con el timeout de Twilio
        console.log('STEP 5: sending ack to', message.phone);
        await sendWhatsAppMessage(message.phone, '📥 Recibí tu archivo. Estoy procesándolo...');
        console.log('STEP 6: ack sent — deferring Excel processing to background via after()');

        // Procesar en background DESPUÉS de retornar el 200 a Twilio.
        // after() garantiza que el processing continúa hasta completarse
        // aunque la Response ya fue enviada.
        after(processExcelBackground(message.phone, message.mediaUrl!));
        break;
      }

      case 'CONFIRM_ORDER': {
        try {
          const client = await identifyClient(message.phone);
          console.log('STEP 4 (CONFIRM): client =', client?.id ?? 'NOT FOUND');
          if (!client) {
            console.log('STEP 5: sending not-registered reply');
            await sendWhatsAppMessage(message.phone, '⚠️ No encontré tu cuenta asociada a este número. Contactá a Sheina para registrarte.');
            console.log('STEP 6: not-registered reply sent');
            break;
          }

          const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('organization_id', client.organization_id)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!order) {
            console.log('STEP 5: sending no-draft-order reply');
            await sendWhatsAppMessage(message.phone, 'No encontré un pedido pendiente de confirmación.');
            console.log('STEP 6: no-draft-order reply sent');
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

          console.log('STEP 5: sending confirmed reply to', message.phone);
          await sendWhatsAppMessage(
            message.phone,
            `✅ ¡Pedido confirmado!\nTotal: ${order.total_units} viandas — ${order.week_label}\n\nSi necesitás hacer cambios antes del corte, enviá un nuevo Excel.`
          );
          console.log('STEP 6: confirmed reply sent');
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('STEP FAILED (CONFIRM_ORDER):', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
        }
        break;
      }

      case 'CANCEL_ORDER': {
        try {
          const client = await identifyClient(message.phone);
          console.log('STEP 4 (CANCEL): client =', client?.id ?? 'NOT FOUND');
          if (!client) {
            console.log('STEP 5: sending not-registered reply');
            await sendWhatsAppMessage(message.phone, '⚠️ No encontré tu cuenta asociada a este número. Contactá a Sheina para registrarte.');
            console.log('STEP 6: not-registered reply sent');
            break;
          }

          const { data: order } = await supabase
            .from('orders')
            .select('*, menu:weekly_menus(*)')
            .eq('organization_id', client.organization_id)
            .in('status', ['draft', 'confirmed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!order) {
            console.log('STEP 5: sending no-active-order reply');
            await sendWhatsAppMessage(message.phone, 'No encontré un pedido activo para cancelar.');
            console.log('STEP 6: no-active-order reply sent');
            break;
          }

          if (order.status === 'confirmed') {
            const { data: org } = await supabase
              .from('organizations')
              .select('cutoff_time, cutoff_days_before')
              .eq('id', client.organization_id)
              .single();

            if (org && !isWithinCutoff(order, order.menu, org)) {
              console.log('STEP 5: sending post-cutoff reply');
              await sendWhatsAppMessage(
                message.phone,
                '⚠️ Ya pasó el horario de corte. Contactá a Sheina para modificar tu pedido.'
              );
              console.log('STEP 6: post-cutoff reply sent');
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

          console.log('STEP 5: sending cancelled reply to', message.phone);
          await sendWhatsAppMessage(
            message.phone,
            `🚫 Pedido cancelado — ${order.week_label}\n\nSi querés hacer un nuevo pedido, enviame el Excel.`
          );
          console.log('STEP 6: cancelled reply sent');
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('STEP FAILED (CANCEL_ORDER):', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
        }
        break;
      }

      case 'HELP': {
        try {
          const client = await identifyClient(message.phone);
          console.log('STEP 4 (HELP):', JSON.stringify({ phone: message.phone, found: !!client, organizationId: client?.organization_id ?? null }));

          if (!client) {
            console.log('STEP 5: sending not-registered reply to', message.phone);
            await sendWhatsAppMessage(
              message.phone,
              `⚠️ Tu número *${message.phone}* no está registrado en el sistema de Grupo Sheina.\n\nContactá a Sheina para que te den de alta.`
            );
            console.log('STEP 6: not-registered reply sent');
          } else {
            console.log('STEP 5: sending help reply to', message.phone);
            await sendWhatsAppMessage(
              message.phone,
              `👋 ¡Hola${client.full_name ? `, ${client.full_name.split(' ')[0]}` : ''}! Soy el asistente de *Grupo Sheina*.\n\nPodés:\n📎 *Enviar tu Excel* de pedidos y lo proceso automáticamente\n✅ Responder *confirmo* para confirmar un pedido\n❌ Responder *cancelar* para anular un pedido\n\n¿En qué te puedo ayudar?`
            );
            console.log('STEP 6: help reply sent');
          }
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('STEP FAILED (HELP):', JSON.stringify({ message: e.message, stack: e.stack, name: e.name }));
        }
        break;
      }
    }

    // Retornar 200 a Twilio inmediatamente.
    // Para PROCESS_EXCEL, el procesamiento continúa en background via after().
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('STEP FAILED (UNHANDLED):', JSON.stringify({ message: err.message, stack: err.stack, name: err.name }));
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
