"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { registerMovement } from "@/lib/inventory/movements";
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

  try {
    await registerMovement({
      itemId: input.itemId,
      movementType: "waste_approved",
      quantity: input.quantity,
      reason: input.reason.trim() || "Merma durante producción",
      actorId: currentUser.id,
      referenceType: "production_ticket",
      referenceId: ticketId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al registrar merma";
    return { ok: false, error: msg };
  }

  revalidatePath(`/operador/produccion/${ticketId}`);

  return { ok: true, data: undefined };
}
