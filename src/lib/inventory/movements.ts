import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { MovementType } from "@/lib/types/database";

interface CreateMovementInput {
  itemId: string;
  movementType: MovementType;
  quantity: number;
  unitCost?: number;
  reason?: string;
  actorId?: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Registra un movimiento de inventario usando la RPC atómica `fn_update_stock`.
 * La operación es atómica: UPDATE stock + INSERT movement en una sola transacción.
 * La RPC maneja el signo del qty según el movement_type (no pasar negativo).
 * Lanza excepción si el stock quedaría negativo (excepto adjustment_neg).
 */
export async function registerMovement(input: CreateMovementInput): Promise<void> {
  const supabase = await createSupabaseAdmin();
  const absQty = Math.abs(input.quantity);

  const { error } = await supabase.rpc("fn_update_stock", {
    p_item_id: input.itemId,
    p_qty: absQty,
    p_movement_type: input.movementType,
    p_reason: input.reason ?? null,
    p_actor_id: input.actorId ?? null,
    p_unit_cost: input.unitCost ?? null,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
