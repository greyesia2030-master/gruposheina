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

const POSITIVE_TYPES: MovementType[] = ["purchase", "adjustment_pos", "return"];

/**
 * Registra un movimiento de inventario y actualiza el stock.
 */
export async function registerMovement(input: CreateMovementInput) {
  const supabase = await createSupabaseAdmin();

  // Obtener stock actual
  const { data: item, error: fetchError } = await supabase
    .from("inventory_items")
    .select("current_stock, cost_per_unit")
    .eq("id", input.itemId)
    .single();

  if (fetchError || !item) {
    throw new Error("Insumo no encontrado");
  }

  const absQty = Math.abs(input.quantity);
  const isPositive = POSITIVE_TYPES.includes(input.movementType);
  const newStock = isPositive
    ? item.current_stock + absQty
    : item.current_stock - absQty;

  // Actualizar stock
  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ current_stock: newStock })
    .eq("id", input.itemId);

  if (updateError) {
    throw new Error(`Error actualizando stock: ${updateError.message}`);
  }

  // Registrar movimiento
  const { data: movement, error: movError } = await supabase
    .from("inventory_movements")
    .insert({
      item_id: input.itemId,
      movement_type: input.movementType,
      quantity: isPositive ? absQty : -absQty,
      unit_cost: input.unitCost ?? item.cost_per_unit,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      reason: input.reason ?? null,
      actor_id: input.actorId ?? null,
      stock_after: newStock,
    })
    .select()
    .single();

  if (movError) {
    throw new Error(`Error registrando movimiento: ${movError.message}`);
  }

  return movement;
}
