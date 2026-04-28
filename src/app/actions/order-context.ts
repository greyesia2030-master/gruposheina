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
  actualParticipants: number;
  expectedTotalParticipants: number;
  cutoffAt: string;
  currentParticipant?: { display_name: string; section_name: string };
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getOrderContext(
  token: string,
  accessToken?: string
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

  const [orgRes, orderRes, sectionsRes, participantsRes, deptRes, participantRes] =
    await Promise.all([
      db
        .from("organizations")
        .select("name, member_id")
        .eq("id", organization_id)
        .maybeSingle(),
      db
        .from("orders")
        .select("week_label, custom_cutoff_at")
        .eq("id", order_id)
        .maybeSingle(),
      db
        .from("order_sections")
        .select("id, name, closed_at")
        .eq("order_id", order_id),
      db
        .from("order_participants")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order_id)
        .not("submitted_at", "is", null),
      db
        .from("client_departments")
        .select("name, expected_participants")
        .eq("organization_id", organization_id),
      accessToken
        ? db
            .from("order_participants")
            .select("display_name, order_sections(name)")
            .eq("access_token", accessToken)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const org = orgRes.data as { name: string; member_id: string | null } | null;
  const order = orderRes.data as { week_label: string; custom_cutoff_at: string | null } | null;
  const sections = (sectionsRes.data ?? []) as { id: string; name: string; closed_at: string | null }[];
  const depts = (deptRes.data ?? []) as { name: string; expected_participants: number }[];

  if (!org || !order) return { ok: false, error: "data_missing" };

  const sectionNames = new Set(sections.map((s) => s.name.toLowerCase()));
  const expectedTotalParticipants = depts
    .filter((d) => sectionNames.has(d.name.toLowerCase()))
    .reduce((sum, d) => sum + (d.expected_participants ?? 0), 0);

  let currentParticipant: { display_name: string; section_name: string } | undefined;
  if (participantRes.data) {
    const row = participantRes.data as unknown as {
      display_name: string;
      order_sections: { name: string } | { name: string }[] | null;
    };
    const sectionObj = Array.isArray(row.order_sections)
      ? row.order_sections[0]
      : row.order_sections;
    currentParticipant = {
      display_name: row.display_name,
      section_name: sectionObj?.name ?? "",
    };
  }

  // custom_cutoff_at is the real order deadline; fallback to token expiry if not set
  const cutoffAt = order.custom_cutoff_at ?? valid_until;

  return {
    ok: true,
    data: {
      orderCode: order_id.slice(0, 8).toUpperCase(),
      organizationName: org.name,
      memberId: org.member_id,
      weekLabel: order.week_label,
      totalSections: sections.length,
      closedSections: sections.filter((s) => s.closed_at !== null).length,
      actualParticipants: participantsRes.count ?? 0,
      expectedTotalParticipants,
      cutoffAt,
      currentParticipant,
    },
  };
}
