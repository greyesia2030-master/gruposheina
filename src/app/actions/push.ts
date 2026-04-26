'use server';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin-client';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:greyes.ia2030@gmail.com';

let vapidConfigured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
}

export type PushPayload = { title: string; body: string; url?: string };

/** UPSERT de suscripción por endpoint (una fila por dispositivo/browser). */
export async function subscribeParticipantPush(input: {
  participantId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supa = createAdminClient();
  const { error } = await supa.from('push_subscriptions').upsert(
    {
      participant_id: input.participantId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: 'endpoint' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Borra endpoint (cuando browser lo invalida). */
export async function unsubscribeParticipantPush(endpoint: string): Promise<{ ok: boolean }> {
  const supa = createAdminClient();
  await supa.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return { ok: true };
}

/** Envía push a todos los endpoints de un participant; limpia endpoints 410/404. */
export async function sendPushToParticipant(
  participantId: string,
  payload: PushPayload
): Promise<{ ok: boolean; sent?: number; failed?: number; error?: string }> {
  if (!vapidConfigured) return { ok: false, error: 'VAPID not configured' };
  const supa = createAdminClient();
  const { data: subs, error } = await supa
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('participant_id', participantId);
  if (error) return { ok: false, error: error.message };
  if (!subs?.length) return { ok: true, sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
    )
  );

  const deadEndpoints: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) deadEndpoints.push(subs[i].endpoint);
    }
  });
  if (deadEndpoints.length) {
    await supa.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  return {
    ok: true,
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}

/** Envía push a todos los participants de una orden. Best-effort. */
export async function sendPushToOrderParticipants(
  orderId: string,
  payload: PushPayload
): Promise<{ ok: boolean; sent: number; failed: number }> {
  const supa = createAdminClient();
  const { data: parts } = await supa
    .from('order_participants')
    .select('id')
    .eq('order_id', orderId);
  if (!parts?.length) return { ok: true, sent: 0, failed: 0 };

  let totalSent = 0, totalFailed = 0;
  for (const p of parts) {
    const r = await sendPushToParticipant(p.id, payload);
    if (r.ok) { totalSent += r.sent ?? 0; totalFailed += r.failed ?? 0; }
  }
  return { ok: true, sent: totalSent, failed: totalFailed };
}
