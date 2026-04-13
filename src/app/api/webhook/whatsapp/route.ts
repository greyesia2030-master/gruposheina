import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { classifyMessage } from '@/lib/whatsapp/classify-message';
import { identifyClient } from '@/lib/whatsapp/receive-message';
import { sendWhatsAppMessage, sendLongWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { formatCompactSummary, formatOrderSummaryDetailed } from '@/lib/whatsapp/format-summary';
import { responses } from '@/lib/whatsapp/responses';
import { logConversation } from '@/lib/whatsapp/audit-log';
import { getClientContext, setState } from '@/lib/whatsapp/conversation-state';
import {
  validateOrgActive,
  validateNoDuplicate,
  validateExcelStructure,
  checkConfirmedOrderForWeek,
} from '@/lib/whatsapp/validations';
import { parseSheinaExcel } from '@/lib/excel/sheina-parser';
import { parseExcelWithAI } from '@/lib/ai/claude-client';
import { createOrderEvent } from '@/lib/orders/events';
import { isWithinCutoff } from '@/lib/orders/cutoff';
import { createSupabaseAdmin } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Signature validation
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

// ---------------------------------------------------------------------------
// Reply helpers — send + log in one call
// ---------------------------------------------------------------------------

async function reply(phone: string, text: string, orderId?: string, convState?: string) {
  await sendWhatsAppMessage(phone, text);
  void logConversation('out', phone, { body: text, orderId, convState });
}

async function replyLong(phone: string, text: string, orderId?: string, convState?: string) {
  await sendLongWhatsAppMessage(phone, text);
  void logConversation('out', phone, { body: text, orderId, convState });
}

// ---------------------------------------------------------------------------
// Background Excel processing
// ---------------------------------------------------------------------------

async function processExcelBackground(
  phone: string,
  mediaUrl: string,
  clientId: string,
  orgId: string,
  orgName: string
) {
  try {
    console.log('EXCEL: downloading...');
    const fileRes = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    });
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    console.log('EXCEL: downloaded', buffer.length, 'bytes');

    console.log('EXCEL: parsing with sheina-parser...');
    const parseResult = await parseSheinaExcel(buffer);
    console.log('EXCEL: parsed,', parseResult.errors.length, 'errors,', parseResult.weeks?.length ?? 0, 'weeks');

    if (parseResult.errors.length > 0) {
      await reply(phone, responses.parseError(parseResult.errors), undefined, 'idle');
      await setState(phone, 'idle');
      return;
    }

    // Soft check: company name in Excel vs registered org (warn only, never block)
    if (parseResult.weeks[0]?.companyName) {
      const excelCompany = parseResult.weeks[0].companyName;
      const normalize = (s: string) =>
        s.toLowerCase().replace(/\s+(s\.?r\.?l\.?|s\.?a\.?s?\.?|s\.?a\.)$/i, '').trim();
      const orgNorm = normalize(orgName);
      const excelNorm = normalize(excelCompany);
      if (orgNorm && excelNorm && !excelNorm.includes(orgNorm) && !orgNorm.includes(excelNorm)) {
        console.warn(`EXCEL: company mismatch — org="${orgName}" excel="${excelCompany}"`);
        await reply(
          phone,
          `⚠️ El archivo parece pertenecer a *${excelCompany}*. Si es tu Excel correcto, ignorá este mensaje.`
        );
      }
    }

    console.log('EXCEL: calling Claude API...');
    const validatedData = await parseExcelWithAI(parseResult);
    console.log('EXCEL: Claude ok — week:', validatedData.weekLabel, 'units:', validatedData.totalUnits);

    // Check for already-confirmed order this week — warn but don't block
    const confirmedCheck = await checkConfirmedOrderForWeek(orgId, validatedData.weekLabel);
    if (confirmedCheck.exists) {
      console.log(`EXCEL: confirmed order exists for week "${validatedData.weekLabel}" — warning user`);
      await reply(
        phone,
        `⚠️ Ya tenés un pedido *confirmado* para *${validatedData.weekLabel}* (${confirmedCheck.totalUnits} viandas).\n\nIgual creo un borrador nuevo. Hablá con el equipo de Sheina si necesitás modificarlo.`,
        confirmedCheck.orderId
      );
    }

    const supabase = await createSupabaseAdmin();

    // Find current published menu
    const { data: menus } = await supabase
      .from('weekly_menus')
      .select('id, week_start, week_end')
      .eq('status', 'published')
      .order('week_start', { ascending: false })
      .limit(5);

    let menuId: string | null = null;
    if (menus && menus.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const current = menus.find((m) => m.week_start <= today && m.week_end >= today);
      menuId = (current ?? menus[0]).id;
    }

    // Price per unit for total_amount calculation
    const { data: orgData } = await supabase
      .from('organizations')
      .select('price_per_unit')
      .eq('id', orgId)
      .single();
    const pricePerUnit = (orgData?.price_per_unit as number | null) ?? 0;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        organization_id: orgId,
        menu_id: menuId,
        week_label: validatedData.weekLabel,
        status: 'draft',
        source: 'whatsapp_excel',
        total_units: validatedData.totalUnits,
        total_amount: pricePerUnit > 0 ? validatedData.totalUnits * pricePerUnit : 0,
        ai_parsing_log: validatedData as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(`Error creando pedido: ${orderError?.message}`);
    }
    console.log('EXCEL: order created', order.id);

    // Create order lines
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
      console.log('EXCEL:', lines.length, 'lines created');
    }

    // Upload original file to Storage (non-blocking)
    try {
      const storagePath = `${orgId}/${order.id}/original.xlsx`;
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

    // Audit event
    await createOrderEvent({
      orderId: order.id,
      eventType: 'created',
      actorId: clientId,
      actorRole: 'client',
      payload: { source: 'whatsapp_excel', totalUnits: validatedData.totalUnits },
    });

    // Send compact summary and update conversation state
    const summary = formatCompactSummary(validatedData, orgName);
    console.log('EXCEL: summary', summary.length, 'chars');
    await replyLong(phone, summary, order.id, 'awaiting_confirmation');
    await setState(phone, 'awaiting_confirmation', order.id);
    console.log('EXCEL: done — state = awaiting_confirmation');

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('EXCEL PROCESS FAILED:', msg, error instanceof Error ? error.stack : '');
    try {
      await reply(phone, responses.processingError(msg), undefined, 'idle');
      await setState(phone, 'idle');
    } catch { /* swallow secondary error */ }
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);

    const rawPhone  = params.get('From') ?? '';
    const rawBody   = params.get('Body') ?? '';
    const numMedia  = parseInt(params.get('NumMedia') ?? '0', 10);
    const mediaUrl  = params.get('MediaUrl0') ?? undefined;
    const mediaType = params.get('MediaContentType0') ?? undefined;

    console.log('WEBHOOK INCOMING:', JSON.stringify({
      from: rawPhone,
      body: rawBody.slice(0, 80),
      numMedia,
      mediaType: mediaType ?? null,
    }));

    // 1. Validate Twilio signature
    if (!validateTwilioSignature(request, bodyText)) {
      const hasSignature = !!request.headers.get('x-twilio-signature');
      const hasToken = !!process.env.TWILIO_AUTH_TOKEN;
      console.error('WEBHOOK SIGNATURE FAILED:', JSON.stringify({ hasSignature, hasToken, url: request.url }));
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 2. Classify message
    const msg = classifyMessage({ From: rawPhone, Body: rawBody, NumMedia: String(numMedia), MediaUrl0: mediaUrl, MediaContentType0: mediaType });
    console.log('WEBHOOK classified:', msg.type, '| phone:', msg.phone);

    // 3. Log incoming (non-blocking)
    void logConversation('in', msg.phone, {
      type: msg.type,
      body: msg.text,
      mediaUrl: msg.mediaUrl,
    });

    // 4. Identify client
    const client = await identifyClient(msg.phone);
    if (!client || !client.organization_id) {
      await reply(msg.phone, responses.notRegistered(msg.phone));
      return xmlOk();
    }

    // 5. Validate org is active
    const orgCheck = await validateOrgActive(client.organization_id);
    if (!orgCheck.ok) {
      await reply(msg.phone, responses.orgInactive());
      return xmlOk();
    }

    // 6. Get client conversation context
    const ctx = await getClientContext(client.organization_id);

    const supabase = await createSupabaseAdmin();

    // 7. Dispatch by message type
    switch (msg.type) {

      // ── Excel válido ──────────────────────────────────────────────────────
      case 'EXCEL_FILE': {
        const fileCheck = validateExcelStructure(msg.mediaContentType ?? '', numMedia);
        if (!fileCheck.ok) {
          await reply(msg.phone, responses.invalidFile(msg.mediaContentType ?? ''));
          break;
        }

        // Fetch org name for company-name validation and summary header
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', client.organization_id)
          .single();
        const orgName = (orgRow?.name as string | null) ?? '';

        // Check for existing draft — cancel it if found
        const dupCheck = await validateNoDuplicate(client.organization_id);
        const ackMsg = dupCheck.cancelledDraftId
          ? responses.replacedByNew()
          : responses.processing();

        await reply(msg.phone, ackMsg, undefined, 'processing');
        await setState(msg.phone, 'processing');
        after(processExcelBackground(msg.phone, msg.mediaUrl!, client.id, client.organization_id, orgName));
        break;
      }

      // ── Archivo no-Excel ──────────────────────────────────────────────────
      case 'INVALID_FILE': {
        await reply(msg.phone, responses.invalidFile(msg.mediaContentType ?? 'desconocido'));
        break;
      }

      // ── Confirmación ──────────────────────────────────────────────────────
      case 'CONFIRM': {
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('organization_id', client.organization_id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!order) {
          await reply(msg.phone, responses.noOrderToConfirm());
          break;
        }

        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
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

        await reply(msg.phone, responses.confirmSuccess(order.total_units, order.week_label), order.id, 'confirmed');
        await setState(msg.phone, 'confirmed', order.id);
        break;
      }

      // ── Cancelación ───────────────────────────────────────────────────────
      case 'CANCEL': {
        const { data: order } = await supabase
          .from('orders')
          .select('*, menu:weekly_menus(*)')
          .eq('organization_id', client.organization_id)
          .in('status', ['draft', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!order) {
          await reply(msg.phone, responses.noOrderToCancel());
          break;
        }

        if (order.status === 'confirmed') {
          const { data: org } = await supabase
            .from('organizations')
            .select('cutoff_time, cutoff_days_before')
            .eq('id', client.organization_id)
            .single();
          if (org && !isWithinCutoff(order, order.menu, org)) {
            await reply(msg.phone, responses.postCutoff(), order.id);
            break;
          }
        }

        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
        await createOrderEvent({
          orderId: order.id,
          eventType: 'cancelled',
          actorId: client.id,
          actorRole: 'client',
        });

        await reply(msg.phone, responses.cancelSuccess(order.week_label), order.id, 'idle');
        await setState(msg.phone, 'idle');
        break;
      }

      // ── Reemplazar borrador con nuevo Excel ───────────────────────────────
      case 'REPLACE': {
        // User said "reemplazar" as text — cancel any drafts and prompt for Excel
        const { data: drafts } = await supabase
          .from('orders')
          .select('id, week_label')
          .eq('organization_id', client.organization_id)
          .eq('status', 'draft');

        if (drafts && drafts.length > 0) {
          for (const draft of drafts) {
            await supabase.from('orders').update({ status: 'cancelled' }).eq('id', draft.id);
            await createOrderEvent({
              orderId: draft.id,
              eventType: 'cancelled',
              actorId: client.id,
              actorRole: 'client',
              payload: { reason: 'replaced_by_client' },
            });
          }
        }

        await reply(msg.phone, `🔄 Pedido anterior cancelado. Enviame el nuevo Excel cuando quieras.`, undefined, 'idle');
        await setState(msg.phone, 'idle');
        break;
      }

      // ── Consulta de estado ────────────────────────────────────────────────
      case 'STATUS': {
        if (!ctx.pendingOrderId) {
          await reply(msg.phone, responses.noActiveOrder());
          break;
        }
        await reply(
          msg.phone,
          responses.orderStatus(ctx.pendingWeekLabel!, ctx.convState === 'confirmed' ? 'confirmed' : 'draft', ctx.pendingTotalUnits!),
          ctx.pendingOrderId
        );
        break;
      }

      // ── Desglose detallado ────────────────────────────────────────────────
      case 'DETAIL': {
        if (!ctx.pendingOrderId) {
          await reply(msg.phone, responses.noActiveOrder());
          break;
        }

        // Load ai_parsing_log for detailed breakdown
        const { data: order } = await supabase
          .from('orders')
          .select('ai_parsing_log, week_label, status, total_units')
          .eq('id', ctx.pendingOrderId)
          .single();

        if (order?.ai_parsing_log && typeof order.ai_parsing_log === 'object' && 'days' in order.ai_parsing_log) {
          const detailMsg = formatOrderSummaryDetailed(
            order.ai_parsing_log as Parameters<typeof formatOrderSummaryDetailed>[0]
          );
          await replyLong(msg.phone, detailMsg, ctx.pendingOrderId);
        } else if (order) {
          await reply(
            msg.phone,
            responses.orderStatus(order.week_label, order.status as 'draft' | 'confirmed' | 'in_production' | 'delivered' | 'cancelled', order.total_units),
            ctx.pendingOrderId
          );
        } else {
          await reply(msg.phone, responses.noActiveOrder());
        }
        break;
      }

      // ── Menú semanal ──────────────────────────────────────────────────────
      case 'MENU': {
        await reply(msg.phone, responses.menuNotAvailable());
        break;
      }

      // ── Ayuda / default ───────────────────────────────────────────────────
      case 'HELP':
      default: {
        const name = client.full_name ?? null;
        if (ctx.pendingOrderId && ctx.pendingWeekLabel && ctx.pendingTotalUnits != null) {
          await reply(
            msg.phone,
            responses.welcomeWithPending(name, ctx.pendingWeekLabel, ctx.pendingTotalUnits)
          );
        } else {
          await reply(msg.phone, responses.greeting(name));
        }
        break;
      }
    }

    return xmlOk();

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('WEBHOOK UNHANDLED ERROR:', JSON.stringify({ message: err.message, stack: err.stack }));
    return xmlOk(); // always return 200 to Twilio
  }
}

function xmlOk() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
