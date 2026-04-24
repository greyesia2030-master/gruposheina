"use server";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin-client";

export interface OrderContext {
  orderCode: string;
  organizationName: string;
  memberId: string | null;
  weekLabel: string;
  totalSections: number;
  closedSections: number;
  totalParticipants: number;
  validUntil: string;
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getOrderContext(
  token: string
): Promise<ActionResult<OrderContext>> {
  const db = createAdminClient();

  const { data: tokenRow } = await db
    .from("order_form_tokens")
    .select("order_id, organization_id, valid_until, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!tokenRow?.order_id) return { ok: false, error: "token_invalid" };

  const { order_id, organization_id, valid_until } = tokenRow as {
    order_id: string;
    organization_id: string;
    valid_until: string;
  };

  const [orgRes, orderRes, sectionsRes, participantsRes] = await Promise.all([
    db
      .from("organizations")
      .select("name, member_id")
      .eq("id", organization_id)
      .maybeSingle(),
    db
      .from("orders")
      .select("week_label")
      .eq("id", order_id)
      .maybeSingle(),
    db
      .from("order_sections")
      .select("id, closed_at")
      .eq("order_id", order_id),
    db
      .from("order_participants")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order_id),
  ]);

  const org = orgRes.data as { name: string; member_id: string | null } | null;
  const order = orderRes.data as { week_label: string } | null;
  const sections = (sectionsRes.data ?? []) as { id: string; closed_at: string | null }[];

  if (!org || !order) return { ok: false, error: "data_missing" };

  return {
    ok: true,
    data: {
      orderCode: order_id.slice(0, 8).toUpperCase(),
      organizationName: org.name,
      memberId: org.member_id,
      weekLabel: order.week_label,
      totalSections: sections.length,
      closedSections: sections.filter((s) => s.closed_at !== null).length,
      totalParticipants: participantsRes.count ?? 0,
      validUntil: valid_until,
    },
  };
}
