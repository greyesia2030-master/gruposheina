import { NextRequest, NextResponse } from "next/server";

// Resend webhook for inbound email events (delivery status, inbound parsing)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: validate Resend webhook signature (svix or raw HMAC)
    // TODO: handle event types: email.delivered, email.bounced, email.opened, inbound.email
    console.log("[email/webhook]", body?.type);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
