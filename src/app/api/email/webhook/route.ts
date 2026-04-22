import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { matchIncomingMessage } from "@/lib/messaging/matching";

// Verifies Resend/svix webhook signature without requiring the svix package.
// Format: HMAC-SHA256("{svix-id}.{svix-timestamp}.{rawBody}") vs each "v1,{base64}" entry in svix-signature.
function verifySignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const key = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64"
  );
  const message = `${svixId}.${svixTimestamp}.${rawBody}`;
  const computed = createHmac("sha256", key).update(message).digest("base64");
  const computedBuf = Buffer.from(computed, "base64");

  for (const sig of svixSignature.split(" ")) {
    const [version, b64] = sig.split(",");
    if (version !== "v1" || !b64) continue;
    try {
      const sigBuf = Buffer.from(b64, "base64");
      if (sigBuf.length === computedBuf.length && timingSafeEqual(sigBuf, computedBuf)) return true;
    } catch {
      // skip invalid base64
    }
  }
  return false;
}

async function bumpThreadUnread(supabase: ReturnType<typeof createAdminClient>, threadId: string) {
  const { data } = await supabase
    .from("communication_threads")
    .select("unread_count")
    .eq("id", threadId)
    .single();
  const current = (data as unknown as { unread_count: number } | null)?.unread_count ?? 0;
  await supabase
    .from("communication_threads")
    .update({ last_message_at: new Date().toISOString(), unread_count: current + 1 })
    .eq("id", threadId);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (process.env.RESEND_WEBHOOK_SECRET) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }
    if (!verifySignature(rawBody, svixId, svixTimestamp, svixSignature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { type, data } = event;

  // Delivery status events from Resend
  if (type === "email.delivered" || type === "email.bounced" || type === "email.opened") {
    const emailId = data?.email_id as string | undefined;
    if (!emailId) return NextResponse.json({ ok: true });

    const newStatus =
      type === "email.delivered" ? "delivered" :
      type === "email.opened" ? "read" : "failed";

    const updateFields: Record<string, unknown> = { status: newStatus };
    if (type === "email.delivered") updateFields.delivered_at = new Date().toISOString();
    if (type === "email.opened") updateFields.read_at = new Date().toISOString();
    if (type === "email.bounced") {
      updateFields.status_detail = (data?.bounce_description as string | undefined) ?? "bounced";
    }

    await supabase
      .from("communications")
      .update(updateFields)
      .eq("external_message_id", emailId);

    return NextResponse.json({ ok: true });
  }

  // Inbound email parsed by Resend
  if (type === "inbound.email") {
    const from = (data?.from as string | undefined) ?? "";
    const subject = (data?.subject as string | undefined) ?? "";
    const inReplyTo = (data?.in_reply_to as string | undefined);
    const bodyText = (data?.text as string | undefined) ?? "";
    const bodyHtml = (data?.html as string | undefined) ?? null;
    const externalMessageId = (data?.message_id as string | undefined) ?? null;

    const emailMatch = from.match(/<([^>]+)>/) ?? [null, from];
    const emailAddress = emailMatch[1]?.trim() ?? from.trim();

    const match = await matchIncomingMessage(emailAddress, inReplyTo, subject);

    let threadId = match.thread_id;

    // If no existing thread found, create one
    if (!threadId && match.organization_id) {
      const { data: newThread } = await supabase
        .from("communication_threads")
        .insert({
          organization_id: match.organization_id,
          subject: subject || null,
          category: "otro",
          status: "open",
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .select()
        .single();
      threadId = (newThread as unknown as { id: string } | null)?.id ?? null;
    }

    await supabase.from("communications").insert({
      organization_id: match.organization_id,
      thread_id: threadId,
      channel: "email",
      direction: "inbound",
      category: "otro",
      external_message_id: externalMessageId,
      subject: subject || null,
      body: bodyText,
      body_html: bodyHtml,
      sender_identifier: emailAddress,
      status: "sent",
      attachments: [],
      ai_generated: false,
      status_detail: `match:${match.confidence}`,
      sent_at: new Date().toISOString(),
    });

    if (threadId) {
      await bumpThreadUnread(supabase, threadId);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
