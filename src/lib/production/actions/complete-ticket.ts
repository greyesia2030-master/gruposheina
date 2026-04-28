"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { createOrderEvent } from "@/lib/orders/events";
import type { UserRole } from "@/lib/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALLOWED_ROLES: readonly UserRole[] = [
  "kitchen",
  "warehouse",
  "operator",
  "admin",
  "superadmin",
];

export async function completeProductionTicket(
  ticketId: string,
  input: { quantityProduced: number; quantityWasted: number; wasteReason?: string }
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
    return { ok: false, error: "Tu rol no permite completar tickets." };
  }

  if (input.quantityProduced < 0 || input.quantityWasted < 0) {
    return { ok: false, error: "Las cantidades no pueden ser negativas." };
  }

  const { data: ticket } = await supabase
    .from("production_tickets")
    .select("id, status, order_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { ok: false, error: "Ticket no encontrado" };
  if (ticket.status !== "in_progress") {
    return {
      ok: false,
      error: `El ticket no está en producción (estado: ${ticket.status})`,
    };
  }

  await supabase
    .from("production_tickets")
    .update({
      status: "ready",
      ready_at: new Date().toISOString(),
      quantity_produced: input.quantityProduced,
      quantity_wasted: input.quantityWasted,
    })
    .eq("id", ticketId);

  // Auto-deliver order when all tickets are done
  if (ticket.order_id) {
    const { data: allTickets } = await supabase
      .from("production_tickets")
      .select("id, status")
      .eq("order_id", ticket.order_id);

    const allDone = (allTickets ?? []).every((t) =>
      ["ready", "cancelled"].includes(t.status as string)
    );

    if (allDone) {
      await supabase
        .from("orders")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", ticket.order_id);

      await createOrderEvent({
        orderId: ticket.order_id as string,
        eventType: "delivered",
        actorId: null,
        actorRole: "system",
        payload: { trigger: "all_tickets_ready" },
      });
    }
  }

  revalidatePath("/operador/produccion");
  revalidatePath(`/operador/produccion/${ticketId}`);
  revalidatePath("/operador");
  if (ticket.order_id) {
    revalidatePath(`/pedidos/${ticket.order_id}`);
    revalidatePath("/pedidos");
  }
  revalidatePath("/");

  return { ok: true, data: undefined };
}
