import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { classifyMessage } from '@/lib/whatsapp/classify-message';
import { identifyClient } from '@/lib/whatsapp/receive-message';
import { sendWhatsAppMessage, sendLongWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { formatOrderSummary, formatOrderSummaryDetailed } from '@/lib/whatsapp/format-summary';
import { R } from '@/lib/whatsapp/responses';
import { logIn, logOut } from '@/lib/whatsapp/audit-log';
import { setState } from '@/lib/whatsapp/conversation-state';
import { validateRegisteredUser, validateNoDraftPending, validateExcelFile } from '@/lib/whatsapp/validations';
import { parseSheinaExcel } from '@/lib/excel/sheina-parser';
import { parseExcelWithAI } from '@/lib/ai/claude-client';
import { createOrderEvent } from '@/lib/orders/events';
import { isWithinCutoff } from '@/lib/orders/cutoff';
import { createSupabaseAdmin } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function reply(phone: string, text: string, orderId?: string, convState?: string) {
  await sendWhatsAppMessage(phone, text);
  await logOut(phone, text, orderId, convState);
}

async function replyLong(phone: string, text: string, orderId?: string, convState?: string) {
  await sendLongWhatsAppMessage(phone, text);
  await logOut(phone, text, orderId, convState);
}

// ---------------------------------------------------------------------------
// Background Excel processing
// ---------------------------------------------------------------------------

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
      const msg = R.parseError(parseResult.errors);
      await reply(phone, msg);
      await setState(phone, 'idle');
      return;
    }

    console.log('EXCEL: calling Claude API...');
    const validatedData = await parseExcelWithAI(parseResult);
    console.log('EXCEL: Claude ok, weekLabel =', validatedData.weekLabel, 'totalUnits =', validatedData.totalUnits);

    const userResult = await validateRegisteredUser(phone);
    if (!userResult.ok || !userResult.user) {
      const msg = R.notRegistered(phone);
      await reply(phone, msg);
      return;
    }
    const client = userResult.user as typeof userResult.user & { id: string; organization_id: string };
    if (!client.organization_id) {
      await reply(phone, R.notRegistered(phone));
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
        const { data: urlData } = await supabase.storage
          .from('order-files')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        if (urlData) {
          await supabase.from('orders').update({ original_file_url: urlData.signedUrl }).eq('id', order.id);
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

    // Enviar resumen y actualizar estado de conversación
    const summary = formatOrderSummary(validatedData);
    console.log('EXCEL: summary length =', summary.length, 'chars');
    await replyLong(phone, summary, order.id, 'awaiting_confirmation');
    await setState(phone, 'awaiting_confirmation', order.id);
    console.log('EXCEL: summary sent, state = awaiting_confirmation');
  } catch (error) {
    const errorDetail = error instanceof Error ? error.message : String(error);
    console.error('EXCEL PROCESS FAILED:', errorDetail, error instanceof Error ? error.stack : '');
    try {
      const msg = R.processingError(errorDetail);
      await reply(phone, msg, undefined, 'idle');
      await setState(phone, 'idle');
    } catch {
      // ignorar error al enviar el mensaje de error
    }
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);

    console.log('WEBHOOK INCOMING:', JSON.stringify({
      from: params.get('From') ?? '',
      body: (params.get('Body') ?? '').slice(0, 80),
      numMedia: params.get('NumMedia') ?? '0',
      mediaType: params.get('MediaContentType0') ?? null,
    }));

    // Validar firma Twilio
    if (!validateTwilioSignature(request, bodyText)) {
      const hasSignature = !!request.headers.get('x-twilio-signature');
      const hasToken = !!process.env.TWILIO_AUTH_TOKEN;
      console.error('WEBHOOK SIGNATURE FAILED:', JSON.stringify({ hasSignature, hasToken, url: request.url }));
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Clasificar mensaje
    const webhookBody = {
      From: params.get('From') ?? '',
      Body: params.get('Body') ?? '',
      NumMedia: params.get('NumMedia') ?? '0',
      MediaUrl0: params.get('MediaUrl0') ?? undefined,
      MediaContentType0: params.get('MediaContentType0') ?? undefined,
    };
    const msg = classifyMessage(webhookBody);
    console.log('WEBHOOK classified:', msg.type, '| phone:', msg.phone);

    // Logging de entrada (async, no bloquea)
    void logIn(msg.phone, msg.type, msg.text, msg.mediaUrl);

    const supabase = await createSupabaseAdmin();

    // -----------------------------------------------------------------------
    // Dispatch por tipo de mensaje
    // -----------------------------------------------------------------------
    switch (msg.type) {

      // --- Excel válido ---
      case 'EXCEL_FILE': {
        const fileCheck = validateExcelFile(msg.mediaContentType ?? '', parseInt(webhookBody.NumMedia, 10));
        if (!fileCheck.ok) {
          await reply(msg.phone, R.invalidFile(msg.mediaContentType ?? ''));
          break;
        }
        // ACK inmediato; procesamiento en background
        await reply(msg.phone, R.processing(), undefined, 'processing');
        await setState(msg.phone, 'processing');
        after(processExcelBackground(msg.phone, msg.mediaUrl!));
        break;
      }

      // --- Archivo que no es Excel ---
      case 'INVALID_FILE': {
        await reply(msg.phone, R.invalidFile(msg.mediaContentType ?? 'desconocido'));
        break;
      }

      // --- Confirmación ---
      case 'CONFIRM': {
        const userResult = await validateRegisteredUser(msg.phone);
        if (!userResult.ok) {
          await reply(msg.phone, R.notRegistered(msg.phone));
          break;
        }
        const client = userResult.user!;
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('organization_id', client.organization_id!)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!order) {
          await reply(msg.phone, R.noOrderToConfirm());
          break;
        }

        await supabase
          .from('orders')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: client.id })
          .eq('id', order.id);
        await createOrderEvent({ orderId: order.id, eventType: 'confirmed', actorId: client.id, actorRole: 'client' });

        const confirmMsg = R.confirmSuccess(order.total_units, order.week_label);
        await reply(msg.phone, confirmMsg, order.id, 'confirmed');
        await setState(msg.phone, 'confirmed', order.id);
        break;
      }

      // --- Cancelación ---
      case 'CANCEL': {
        const userResult = await validateRegisteredUser(msg.phone);
        if (!userResult.ok) {
          await reply(msg.phone, R.notRegistered(msg.phone));
          break;
        }
        const client = userResult.user!;
        const { data: order } = await supabase
          .from('orders')
          .select('*, menu:weekly_menus(*)')
          .eq('organization_id', client.organization_id!)
          .in('status', ['draft', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!order) {
          await reply(msg.phone, R.noOrderToCancel());
          break;
        }

        if (order.status === 'confirmed') {
          const { data: org } = await supabase
            .from('organizations')
            .select('cutoff_time, cutoff_days_before')
            .eq('id', client.organization_id!)
            .single();
          if (org && !isWithinCutoff(order, order.menu, org)) {
            await reply(msg.phone, R.postCutoff());
            break;
          }
        }

        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
        await createOrderEvent({ orderId: order.id, eventType: 'cancelled', actorId: client.id, actorRole: 'client' });

        const cancelMsg = R.cancelSuccess(order.week_label);
        await reply(msg.phone, cancelMsg, order.id, 'idle');
        await setState(msg.phone, 'idle');
        break;
      }

      // --- Reemplazar borrador con nuevo Excel ---
      case 'REPLACE': {
        const userResult = await validateRegisteredUser(msg.phone);
        if (!userResult.ok) {
          await reply(msg.phone, R.notRegistered(msg.phone));
          break;
        }
        const client = userResult.user!;

        // Cancelar borradores existentes
        const { data: drafts } = await supabase
          .from('orders')
          .select('id, week_label')
          .eq('organization_id', client.organization_id!)
          .eq('status', 'draft');
        if (drafts && drafts.length > 0) {
          for (const draft of drafts) {
            await supabase.from('orders').update({ status: 'cancelled' }).eq('id', draft.id);
            await createOrderEvent({ orderId: draft.id, eventType: 'cancelled', actorId: client.id, actorRole: 'client', payload: { reason: 'replaced_by_client' } });
          }
        }

        await reply(msg.phone, R.replacedByNew());
        // Indicar que esperamos el nuevo Excel
        await setState(msg.phone, 'idle');
        break;
      }

      // --- Consulta de estado ---
      case 'STATUS': {
        const userResult = await validateRegisteredUser(msg.phone);
        if (!userResult.ok) {
          await reply(msg.phone, R.notRegistered(msg.phone));
          break;
        }
        const client = userResult.user!;
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('organization_id', client.organization_id!)
          .in('status', ['draft', 'confirmed', 'in_production'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!order) {
          await reply(msg.phone, R.noActiveOrder());
          break;
        }
        await reply(msg.phone, R.orderStatus(order.week_label, order.status, order.total_units), order.id);
        break;
      }

      // --- Desglose detallado ---
      case 'DETAIL': {
        const userResult = await validateRegisteredUser(msg.phone);
        if (!userResult.ok) {
          await reply(msg.phone, R.notRegistered(msg.phone));
          break;
        }
        const client = userResult.user!;
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('organization_id', client.organization_id!)
          .in('status', ['draft', 'confirmed', 'in_production'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!order) {
          await reply(msg.phone, R.noActiveOrder());
          break;
        }

        // Reconstruir ValidatedOrderData desde ai_parsing_log para el detalle
        const parsed = order.ai_parsing_log;
        if (parsed && typeof parsed === 'object' && 'days' in parsed) {
          const detailMsg = formatOrderSummaryDetailed(parsed as Parameters<typeof formatOrderSummaryDetailed>[0]);
          await replyLong(msg.phone, detailMsg, order.id);
        } else {
          await reply(msg.phone, R.orderStatus(order.week_label, order.status, order.total_units), order.id);
        }
        break;
      }

      // --- Menú (placeholder) ---
      case 'MENU': {
        await reply(msg.phone, R.menuNotAvailable());
        break;
      }

      // --- Ayuda / default ---
      case 'HELP':
      default: {
        const userResult = await validateRegisteredUser(msg.phone);
        const name = userResult.ok && userResult.user ? userResult.user.full_name : null;
        const helpMsg = userResult.ok ? R.greeting(name) : R.notRegistered(msg.phone);
        await reply(msg.phone, helpMsg);
        break;
      }
    }

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('WEBHOOK UNHANDLED ERROR:', JSON.stringify({ message: err.message, stack: err.stack }));
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
