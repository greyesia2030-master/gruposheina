"use server";

import { createAdminClient } from "@/lib/supabase/admin-client";
import { sendEmail } from "@/lib/email/resend-client";
import { renderTemplate } from "@/lib/messaging/template-renderer";
import type {
  Communication,
  CommunicationThread,
  CommunicationChannel,
  CommunicationCategory,
  CommunicationTemplate,
} from "@/lib/types/database";
import type { CommFilters } from "@/lib/types/communication";
import type { InboxFilters } from "@/lib/types/communication-thread";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendCommunication(
  organizationId: string,
  channel: CommunicationChannel,
  category: CommunicationCategory,
  recipientIdentifier: string,
  body: string,
  options?: {
    subject?: string;
    threadId?: string;
    orderId?: string;
    templateId?: string;
    sentByUserId?: string;
    templateVariables?: Record<string, string>;
  }
): Promise<ActionResult<Communication>> {
  const supabase = createAdminClient();

  let finalSubject = options?.subject ?? null;
  let finalBody = body;
  let finalBodyHtml: string | null = null;
  let templateId = options?.templateId ?? null;

  // Render template if provided
  if (templateId) {
    const { data: tmpl, error: tmplErr } = await supabase
      .from("communication_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    if (tmplErr || !tmpl) return { ok: false, error: "Template not found" };
    const rendered = renderTemplate(tmpl as unknown as CommunicationTemplate, options?.templateVariables ?? {});
    finalSubject = rendered.subject ?? finalSubject;
    finalBody = rendered.body;
    finalBodyHtml = rendered.bodyHtml;
  }

  // Find or create thread
  let threadId = options?.threadId ?? null;
  if (!threadId) {
    const { data: newThread, error: threadErr } = await supabase
      .from("communication_threads")
      .insert({
        organization_id: organizationId,
        subject: finalSubject,
        category,
        order_id: options?.orderId ?? null,
        status: "open",
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .select()
      .single();
    if (threadErr || !newThread) return { ok: false, error: "Failed to create thread" };
    threadId = (newThread as unknown as CommunicationThread).id;
  }

  let externalMessageId: string | null = null;
  let status: Communication["status"] = "sent";

  // Send via email
  if (channel === "email") {
    if (!finalSubject) return { ok: false, error: "Subject is required for email" };
    const emailResult = await sendEmail({
      to: recipientIdentifier,
      subject: finalSubject,
      html: finalBodyHtml ?? undefined,
      text: finalBody,
    });
    if (!emailResult.ok) {
      status = "failed";
    } else {
      externalMessageId = emailResult.data.id;
    }
  } else {
    // Other channels: persist as pending for manual/other handling
    status = "pending";
  }

  const { data: comm, error: commErr } = await supabase
    .from("communications")
    .insert({
      organization_id: organizationId,
      thread_id: threadId,
      order_id: options?.orderId ?? null,
      template_id: templateId,
      channel,
      direction: "outbound",
      category,
      external_message_id: externalMessageId,
      subject: finalSubject,
      body: finalBody,
      body_html: finalBodyHtml,
      recipient_identifier: recipientIdentifier,
      sent_by_user_id: options?.sentByUserId ?? null,
      status,
      attachments: [],
      ai_generated: false,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (commErr || !comm) return { ok: false, error: "Failed to save communication" };

  // Update thread's last_message_at
  await supabase
    .from("communication_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  return { ok: true, data: comm as unknown as Communication };
}

export async function getCommunications(
  filters: CommFilters
): Promise<ActionResult<Communication[]>> {
  const supabase = createAdminClient();
  let q = supabase.from("communications").select("*").order("created_at", { ascending: false });

  if (filters.orgId) q = q.eq("organization_id", filters.orgId);
  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.direction) q = q.eq("direction", filters.direction);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
  if (filters.dateTo) q = q.lte("created_at", filters.dateTo);

  const { data, error } = await q.limit(200);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as Communication[] };
}

export async function getThreads(
  filters: InboxFilters
): Promise<ActionResult<CommunicationThread[]>> {
  const supabase = createAdminClient();
  let q = supabase
    .from("communication_threads")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
  if (filters.orgId) q = q.eq("organization_id", filters.orgId);

  const { data, error } = await q.limit(100);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as CommunicationThread[] };
}

export async function updateThreadStatus(
  threadId: string,
  status: CommunicationThread["status"],
  assignedTo?: string
): Promise<ActionResult<void>> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("communication_threads")
    .update({ status, ...(assignedTo !== undefined ? { assigned_to: assignedTo } : {}) })
    .eq("id", threadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function markThreadRead(threadId: string): Promise<ActionResult<void>> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("communication_threads")
    .update({ unread_count: 0 })
    .eq("id", threadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
