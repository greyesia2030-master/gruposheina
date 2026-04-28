"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
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

export async function recordPartialWaste(
  ticketId: string,
  input: { itemId: string; quantity: number; reason: string }
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
    return { ok: false, error: "Tu rol no permite registrar mermas." };
  }

  if (input.quantity <= 0) {
    return { ok: false, error: "La cantidad debe ser mayor a 0." };
  }

  const { data: ticket } = await supabase
    .from("production_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { ok: false, error: "Ticket no encontrado" };
  if (ticket.status !== "in_progress") {
    return { ok: false, error: "Solo se pueden registrar mermas en tickets en producción." };
  }

  // Get current stock for stock_after (waste_pending doesn't change stock)
  const { data: item } = await supabase
    .from("inventory_items")
    .select("current_stock")
    .eq("id", input.itemId)
    .single();

  const { error } = await supabase.from("inventory_movements").insert({
    item_id: input.itemId,
    movement_type: "waste_pending",
    quantity: input.quantity,
    reference_type: "production_ticket",
    reference_id: ticketId,
    reason: input.reason.trim() || "Merma durante producción",
    actor_id: currentUser.id,
    stock_after: (item?.current_stock as number) ?? 0,
  });

  if (error) {
    return { ok: false, error: `Error al registrar merma: ${error.message}` };
  }

  revalidatePath(`/operador/produccion/${ticketId}`);

  return { ok: true, data: undefined };
}
