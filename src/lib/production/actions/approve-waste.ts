"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import type { UserRole } from "@/lib/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALLOWED_ROLES: readonly UserRole[] = ["admin", "superadmin"];

export async function approveWaste(movementId: string): Promise<ActionResult> {
  const supabase = await createSupabaseAdmin();

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Error de autenticación" };
  }

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    return { ok: false, error: "Solo admins pueden aprobar mermas." };
  }

  const { data: movement } = await supabase
    .from("inventory_movements")
    .select("id, item_id, quantity, reason, movement_type")
    .eq("id", movementId)
    .single();

  if (!movement) return { ok: false, error: "Movimiento no encontrado" };
  if (movement.movement_type !== "waste_pending") {
    return { ok: false, error: "Este movimiento no está pendiente de aprobación." };
  }

  // Mark as approved
  await supabase
    .from("inventory_movements")
    .update({ movement_type: "waste_approved" })
    .eq("id", movementId);

  // Deduct from stock via fn_update_stock
  await supabase.rpc("fn_update_stock", {
    p_item_id: movement.item_id,
    p_qty: movement.quantity,
    p_movement_type: "waste_approved",
    p_reason: movement.reason ?? "Merma aprobada",
    p_actor_id: currentUser.id,
    p_unit_cost: null,
    p_reference_type: "waste_approval",
    p_reference_id: movementId,
  });

  revalidatePath("/");
  revalidatePath("/inventario");

  return { ok: true, data: undefined };
}

export async function rejectWaste(movementId: string): Promise<ActionResult> {
  const supabase = await createSupabaseAdmin();

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Error de autenticación" };
  }

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    return { ok: false, error: "Solo admins pueden rechazar mermas." };
  }

  await supabase
    .from("inventory_movements")
    .update({ movement_type: "adjustment_neg", reason: "Merma rechazada" })
    .eq("id", movementId);

  revalidatePath("/");

  return { ok: true, data: undefined };
}
