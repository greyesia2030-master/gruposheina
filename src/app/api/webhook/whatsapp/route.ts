import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { classifyMessage } from '@/lib/whatsapp/classify-message';
import { identifyClient } from '@/lib/whatsapp/receive-message';
import { sendWhatsAppMessage, sendLongWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { formatCompactSummary, formatCreatedMultiSummary, formatOrderSummaryDetailed } from '@/lib/whatsapp/format-summary';
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
import { convertWeekToValidated } from '@/lib/ai/claude-client';
import { createOrderEvent } from '@/lib/orders/events';
import { isWithinCutoff } from '@/lib/orders/cutoff';
import { createSupabaseAdmin } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Rate limiter — module-level Map persists across warm invocations
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX       = 10;     // max requests per window per phone
const phoneRateMap         = new Map<string, number[]>();

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const timestamps = (phoneRateMap.get(phone) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  phoneRateMap.set(phone, [...timestamps, now]);
  // Evict oldest entry when map grows too large to prevent memory leak
  if (phoneRateMap.size > 1000) phoneRateMap.delete(phoneRateMap.keys().next().value!);
  return true;
}

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

/** Intenta asociar una semana con su menú publicado por fecha o cae al más reciente. */
function findMenuIdForWeek(
  weekLabel: string,
  menus: { id: string; week_start: string; week_end: string }[]
): string | null {
  if (menus.length === 0) return null;
  // Try to parse "DD.MM AL DD.MM" sheet-name format
  const m = weekLabel.match(/(\d{1,2})[./](\d{1,2})\s*AL\s*(\d{1,2})[./](\d{1,2})/i);
  if (m) {
    const year = new Date().getFullYear();
    const startDate = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const found = menus.find((wm) => wm.week_start === startDate);
    if (found) return found.id;
  }
  // Fall back: current week → latest
  const today = new Date().toISOString().slice(0, 10);
  const current = menus.find((wm) => wm.week_start <= today && wm.week_end >= today);
  return (current ?? menus[0]).id;
}

async function processExcelBackground(
  phone: string,
  mediaUrl: string,
  clientId: string,
  orgId: string,
  orgName: string
) {
  try {
    const fileRes = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    });
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const parseResult = await parseSheinaExcel(buffer);

    if (parseResult.errors.length > 0) {
      await reply(phone, responses.parseError(parseResult.errors), undefined, 'idle');
      await setState(phone, 'idle');
      return;
    }

    // Skip weeks where every day has totalUnits = 0 (all holidays)
    const validWeeks = parseResult.weeks.filter(
      (w) => w.days.reduce((s, d) => s + d.totalUnits, 0) > 0
    );
    if (validWeeks.length === 0) {
      await reply(phone, '📋 El Excel solo contiene semanas de feriado, no se crearon pedidos.', undefined, 'idle');
      await setState(phone, 'idle');
      return;
    }

    const supabase = await createSupabaseAdmin();

    // Load all published menus (for week matching) + org price
    const [{ data: menus }, { data: orgData }] = await Promise.all([
      supabase
        .from('weekly_menus')
        .select('id, week_start, week_end')
        .eq('status', 'published')
        .order('week_start', { ascending: false })
        .limit(10),
      supabase.from('organizations').select('price_per_unit').eq('id', orgId).single(),
    ]);
    const pricePerUnit = (orgData?.price_per_unit as number | null) ?? 0;

    // Process each week independently — direct TS conversion, no Claude API call
    const createdOrders: Array<{ weekLabel: string; totalUnits: number; orderId: string; validatedData: ReturnType<typeof convertWeekToValidated> }> = [];

    for (const week of validWeeks) {
      const validatedData = convertWeekToValidated(week);

      // Warn if a confirmed order already exists for this week (non-blocking)
      const confirmedCheck = await checkConfirmedOrderForWeek(orgId, validatedData.weekLabel);
      if (confirmedCheck.exists) {
        await reply(
          phone,
          `⚠️ Ya tenés un pedido *confirmado* para *${validatedData.weekLabel}* (${confirmedCheck.totalUnits} viandas). Igual creo un borrador nuevo.`,
          confirmedCheck.orderId
        );
      }

      const menuId = findMenuIdForWeek(week.sheetName, menus ?? []);

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

      if (orderError || !order) throw new Error(`Error creando pedido ${validatedData.weekLabel}: ${orderError?.message}`);

      const lines = validatedData.days.flatMap((day) =>
        day.options
          .filter((opt) => opt.mainQuantity > 0)
          .map((opt) => ({
            order_id: order.id,
            day_of_week: day.dayOfWeek,
            department: 'general',
            quantity: opt.mainQuantity,
            unit_price: 0,
            option_code: opt.code,
            display_name: opt.displayName,
          }))
      );
      if (lines.length > 0) await supabase.from('order_lines').insert(lines);

      await createOrderEvent({
        orderId: order.id,
        eventType: 'created',
        actorId: clientId,
        actorRole: 'client',
        payload: { source: 'whatsapp_excel', totalUnits: validatedData.totalUnits },
      });

      createdOrders.push({ weekLabel: validatedData.weekLabel, totalUnits: validatedData.totalUnits, orderId: order.id, validatedData });
    }

    // Upload file to storage once (associated to first order)
    try {
      const storagePath = `${orgId}/${createdOrders[0].orderId}/original.xlsx`;
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
          await supabase.from('orders').update({ original_file_url: urlData.signedUrl }).eq('id', createdOrders[0].orderId);
        }
      }
    } catch (storageErr) {
      console.error('EXCEL: storage upload error (non-fatal):', storageErr);
    }

    // Send summary — single week uses compact format, multiple weeks uses multi-week format
    const firstOrderId = createdOrders[0].orderId;
    let summary: string;
    if (createdOrders.length === 1) {
      summary = formatCompactSummary(createdOrders[0].validatedData, orgName);
    } else {
      summary = formatCreatedMultiSummary(
        createdOrders.map((o) => ({ weekLabel: o.weekLabel, totalUnits: o.totalUnits })),
        orgName
      );
    }

    await replyLong(phone, summary, firstOrderId, 'awaiting_confirmation');
    await setState(phone, 'awaiting_confirmation', firstOrderId);

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

    const rawPhone   = params.get('From') ?? '';
    const rawBody    = params.get('Body') ?? '';
    const numMedia   = parseInt(params.get('NumMedia') ?? '0', 10);
    const mediaUrl   = params.get('MediaUrl0') ?? undefined;
    const mediaType  = params.get('MediaContentType0') ?? undefined;
    const messageSid = params.get('MessageSid') ?? '';

    // 1. Validate Twilio signature
    if (!validateTwilioSignature(request, bodyText)) {
      const hasSignature = !!request.headers.get('x-twilio-signature');
      const hasToken = !!process.env.TWILIO_AUTH_TOKEN;
      console.error('WEBHOOK SIGNATURE FAILED:', JSON.stringify({ hasSignature, hasToken, url: request.url }));
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 2. Rate limit — silently drop if exceeded (don't reveal limit to attacker)
    const phoneKey = rawPhone.replace(/^whatsapp:/i, '');
    if (!checkRateLimit(phoneKey)) return xmlOk();

    // 3. Classify message
    const msg = classifyMessage({ From: rawPhone, Body: rawBody, NumMedia: String(numMedia), MediaUrl0: mediaUrl, MediaContentType0: mediaType });

    // 4. MessageSid deduplication — if Twilio retries, skip re-processing
    const supabase = await createSupabaseAdmin();
    if (messageSid) {
      const { count } = await supabase
        .from('conversation_logs')
        .select('id', { count: 'exact', head: true })
        .eq('message_sid', messageSid);
      if ((count ?? 0) > 0) return xmlOk(); // already processed
    }

    // 5. Log incoming (non-blocking)
    void logConversation('in', msg.phone, {
      type: msg.type,
      body: msg.text,
      mediaUrl: msg.mediaUrl,
      messageSid: messageSid || undefined,
    });

    // 6. Identify client
    const client = await identifyClient(msg.phone);
    if (!client || !client.organization_id) {
      await reply(msg.phone, responses.notRegistered(msg.phone));
      return xmlOk();
    }

    // 7. Validate org is active
    const orgCheck = await validateOrgActive(client.organization_id);
    if (!orgCheck.ok) {
      await reply(msg.phone, responses.orgInactive());
      return xmlOk();
    }

    // 8. Get client conversation context
    const ctx = await getClientContext(client.organization_id);

    // 9. Dispatch by message type
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
        const { data: drafts } = await supabase
          .from('orders')
          .select('id, total_units, week_label')
          .eq('organization_id', client.organization_id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false });

        if (!drafts || drafts.length === 0) {
          await reply(msg.phone, responses.noOrderToConfirm());
          break;
        }

        const now = new Date().toISOString();
        for (const draft of drafts) {
          await supabase
            .from('orders')
            .update({ status: 'confirmed', confirmed_at: now })
            .eq('id', draft.id);
          await createOrderEvent({
            orderId: draft.id,
            eventType: 'confirmed',
            actorId: client.id,
            actorRole: 'client',
          });
        }

        let confirmText: string;
        if (drafts.length === 1) {
          confirmText = responses.confirmSuccess(drafts[0].total_units, drafts[0].week_label);
        } else {
          const grandTotal = drafts.reduce((s, d) => s + (d.total_units ?? 0), 0);
          const weekList = drafts.map((d) => `• ${d.week_label} (${d.total_units} viandas)`).join('\n');
          confirmText = `✅ ¡${drafts.length} pedidos confirmados! El equipo de Sheina los revisará.\n\n${weekList}\n\nTotal: *${grandTotal} viandas*`;
        }

        const firstId = drafts[0].id;
        await reply(msg.phone, confirmText, firstId, 'confirmed');
        await setState(msg.phone, 'confirmed', firstId);
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
