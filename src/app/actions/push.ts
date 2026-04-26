"use server";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin-client";

const VAPID_SUBJECT = "mailto:greyes.ia2030@gmail.com";

function initWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
}

export async function subscribeParticipantPush(
  participantId: string,
  subscription: PushSubscriptionJSON
): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("order_participants")
    .update({ push_subscription: subscription })
    .eq("id", participantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendPushToParticipant(
  participantId: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();

  const { data: participant } = await db
    .from("order_participants")
    .select("push_subscription")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant?.push_subscription) return { ok: true }; // no subscription — skip silently

  try {
    initWebPush();
    await webpush.sendNotification(
      participant.push_subscription as webpush.PushSubscription,
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function sendPushToOrderParticipants(
  orderId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const db = createAdminClient();

  const { data: participants } = await db
    .from("order_participants")
    .select("id, push_subscription")
    .eq("order_id", orderId)
    .not("push_subscription", "is", null);

  if (!participants?.length) return;

  try {
    initWebPush();
  } catch {
    console.error("[push] VAPID keys not configured — skipping push notifications");
    return;
  }

  const payloadStr = JSON.stringify(payload);
  await Promise.allSettled(
    participants.map((p) =>
      webpush
        .sendNotification(
          p.push_subscription as webpush.PushSubscription,
          payloadStr
        )
        .catch((err) =>
          console.error(`[push] sendNotification failed for participant ${p.id.slice(0, 8)}:`, err)
        )
    )
  );
}
