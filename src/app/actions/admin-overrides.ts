"use server";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin-client";
import { createSupabaseServer } from "@/lib/supabase/server";
import { hasRole } from "@/lib/permissions";
import type { EventType, MenuItem } from "@/lib/types/database";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function getAdminUser() {
  const serverClient = await createSupabaseServer();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data: dbUser } = await db
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!dbUser || !hasRole(dbUser.role, "admin")) return null;
  return { authId: user.id, dbId: dbUser.id as string, role: dbUser.role };
}

// ─── saveParticipantOverride ──────────────────────────────────────────────────

export async function saveParticipantOverride(params: {
  orderId: string;
  participantId: string;
  changes: Array<{
    lineId?: string;
    menuItemId?: string;
    dayOfWeek: number;
    quantity: number;
    action: "update" | "create" | "delete";
  }>;
}): Promise<ActionResult<void>> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "No autorizado" };

  const db = createAdminClient();
  const { orderId, participantId, changes } = params;

  for (const change of changes) {
    const eventType: EventType =
      change.action === "update"
        ? "line_modified"
        : change.action === "create"
        ? "line_added"
        : "line_removed";

    if (change.action === "delete" && change.lineId) {
      const { error } = await db
        .from("order_lines")
        .delete()
        .eq("id", change.lineId);
      if (error) return { ok: false, error: error.message };
    } else if (change.action === "update" && change.lineId) {
      const { error } = await db
        .from("order_lines")
        .update({ quantity: change.quantity })
        .eq("id", change.lineId);
      if (error) return { ok: false, error: error.message };
    } else if (change.action === "create" && change.menuItemId) {
      const { data: menuItem } = await db
        .from("menu_items")
        .select("option_code, display_name")
        .eq("id", change.menuItemId)
        .maybeSingle();
      if (!menuItem) return { ok: false, error: "Item de menú no encontrado" };

      const { data: participant } = await db
        .from("order_participants")
        .select("section_id")
        .eq("id", participantId)
        .maybeSingle();

      const { error } = await db.from("order_lines").insert({
        order_id: orderId,
        menu_item_id: change.menuItemId,
        day_of_week: change.dayOfWeek,
        department: "participante",
        quantity: change.quantity,
        unit_price: 0,
        option_code: (menuItem as unknown as { option_code: string }).option_code,
        display_name: (menuItem as unknown as { display_name: string }).display_name,
        section_id: participant?.section_id ?? null,
        participant_id: participantId,
      });
      if (error) return { ok: false, error: error.message };
    }

    // Audit event
    await db.from("order_events").insert({
      order_id: orderId,
      event_type: eventType,
      actor_id: admin.dbId,
      actor_role: "admin" as const,
      payload: {
        participant_id: participantId,
        line_id: change.lineId ?? null,
        menu_item_id: change.menuItemId ?? null,
        day_of_week: change.dayOfWeek,
        quantity: change.quantity,
        action: change.action,
      },
      is_post_cutoff: true,
    });
  }

  return { ok: true, data: undefined };
}

// ─── deleteParticipant ────────────────────────────────────────────────────────

export async function deleteParticipant(
  orderId: string,
  participantId: string
): Promise<ActionResult<void>> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "No autorizado" };

  const db = createAdminClient();

  // Fetch participant info for audit log
  const { data: participant } = await db
    .from("order_participants")
    .select("display_name, total_quantity")
    .eq("id", participantId)
    .maybeSingle();

  // Count lines to be deleted
  const { count: linesDeleted } = await db
    .from("order_lines")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId);

  // Delete lines first (FK)
  const { error: linesErr } = await db
    .from("order_lines")
    .delete()
    .eq("participant_id", participantId);
  if (linesErr) return { ok: false, error: linesErr.message };

  // Delete participant
  const { error: partErr } = await db
    .from("order_participants")
    .delete()
    .eq("id", participantId);
  if (partErr) return { ok: false, error: partErr.message };

  // Audit event
  await db.from("order_events").insert({
    order_id: orderId,
    event_type: "override" as EventType,
    actor_id: admin.dbId,
    actor_role: "admin" as const,
    payload: {
      action: "delete_participant",
      participant_id: participantId,
      participant_name: participant?.display_name ?? "desconocido",
      lines_deleted: linesDeleted ?? 0,
    },
    is_post_cutoff: true,
  });

  return { ok: true, data: undefined };
}

// ─── getMenuItemsForOrder ─────────────────────────────────────────────────────

export async function getMenuItemsForOrder(
  orderId: string
): Promise<ActionResult<MenuItem[]>> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "No autorizado" };

  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select("menu_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.menu_id) return { ok: false, error: "Pedido sin menú asociado" };

  const { data: items, error } = await db
    .from("menu_items")
    .select("*")
    .eq("menu_id", order.menu_id)
    .eq("is_available", true)
    .order("day_of_week")
    .order("option_code");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (items ?? []) as unknown as MenuItem[] };
}
