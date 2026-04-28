"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import type { UserRole } from "@/lib/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALLOWED_ROLES: readonly UserRole[] = ["admin", "superadmin"];

export async function cancelProductionTicket(
  ticketId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createSupabaseAdmin();

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Error de autenticación" };
  }

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    return { ok: false, error: "Solo admins pueden cancelar tickets." };
  }

  if (!reason.trim()) {
    return { ok: false, error: "El motivo de cancelación es obligatorio." };
  }

  const { data: ticket } = await supabase
    .from("production_tickets")
    .select("id, status, order_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { ok: false, error: "Ticket no encontrado" };
  if (ticket.status === "cancelled") {
    return { ok: false, error: "El ticket ya está cancelado." };
  }

  // Revert inventory consumptions if any
  const { data: consumptions } = await supabase
    .from("production_lot_consumption")
    .select("lot_id, quantity_consumed, unit")
    .eq("ticket_id", ticketId);

  if (consumptions && consumptions.length > 0) {
    for (const c of consumptions) {
      const { data: lot } = await supabase
        .from("inventory_lots")
        .select("quantity_remaining, item_id, unit")
        .eq("id", c.lot_id)
        .single();

      if (lot) {
        await supabase
          .from("inventory_lots")
          .update({
            quantity_remaining:
              ((lot.quantity_remaining as number) || 0) +
              ((c.quantity_consumed as number) || 0),
            is_depleted: false,
          })
          .eq("id", c.lot_id);

        await supabase.from("inventory_movements").insert({
          item_id: lot.item_id,
          movement_type: "adjustment_pos",
          quantity: c.quantity_consumed,
          unit: lot.unit ?? c.unit,
          reference_type: "production_ticket_cancel",
          reference_id: ticketId,
          reason: `Cancelación de ticket: ${reason.trim()}`,
          actor_id: currentUser.id,
          stock_after: 0,
        });
      }
    }
  }

  await supabase
    .from("production_tickets")
    .update({ status: "cancelled", blocked_reason: reason.trim() })
    .eq("id", ticketId);

  revalidatePath("/operador/produccion");
  revalidatePath(`/operador/produccion/${ticketId}`);
  revalidatePath("/operador");
  if (ticket.order_id) {
    revalidatePath(`/pedidos/${ticket.order_id}`);
  }

  return { ok: true, data: undefined };
}
