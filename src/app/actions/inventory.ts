"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-user";
import { INV_CATEGORY_LABELS } from "@/lib/types/inventory";
import type { InvCategory, MovementType } from "@/lib/types/database";

// ============================================================================
// Result helpers
// ============================================================================

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

async function handleAuth(): Promise<
  | { ok: true; user: Awaited<ReturnType<typeof requireAdmin>> }
  | { ok: false; error: string }
> {
  try {
    const user = await requireAdmin();
    return { ok: true, user };
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    return fail("Error de autenticación");
  }
}

// ============================================================================
// Schemas
// ============================================================================

const INV_CATEGORIES = Object.keys(INV_CATEGORY_LABELS) as [
  InvCategory,
  ...InvCategory[]
];

const createItemSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  category: z.enum(INV_CATEGORIES),
  unit: z.string().trim().min(1, "La unidad es obligatoria").max(20),
  currentStock: z.coerce.number().min(0, "El stock no puede ser negativo"),
  minStock: z.coerce.number().min(0, "El mínimo no puede ser negativo"),
  costPerUnit: z.coerce.number().min(0, "El costo no puede ser negativo"),
  supplier: z.string().trim().max(120).optional(),
});

const updateItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(INV_CATEGORIES),
  supplier: z.string().trim().max(120).optional(),
  minStock: z.coerce.number().min(0),
  costPerUnit: z.coerce.number().min(0),
});

const MOVEMENT_TYPES = [
  "purchase",
  "production_consumption",
  "waste",
  "adjustment_pos",
  "adjustment_neg",
  "return",
] as const satisfies readonly MovementType[];

const registerMovementSchema = z.object({
  itemId: z.string().uuid(),
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unitCost: z.coerce.number().min(0).optional(),
  reason: z.string().trim().max(300).optional(),
});

const deactivateItemSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Actions
// ============================================================================

export async function createItem(
  input: z.input<typeof createItemSchema>
): Promise<ActionResult<{ id: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const supabase = await createSupabaseAdmin();
  const { data: newItem, error } = await supabase
    .from("inventory_items")
    .insert({
      name: data.name,
      category: data.category,
      unit: data.unit,
      current_stock: 0,
      min_stock: data.minStock,
      cost_per_unit: data.costPerUnit,
      supplier: data.supplier?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !newItem) {
    return fail("Error al crear insumo");
  }

  if (data.currentStock > 0) {
    const { error: rpcErr } = await supabase.rpc("fn_update_stock", {
      p_item_id: newItem.id,
      p_qty: data.currentStock,
      p_movement_type: "adjustment_pos",
      p_reason: "Stock inicial",
      p_actor_id: auth.user.id,
      p_unit_cost: data.costPerUnit,
      p_reference_type: null,
      p_reference_id: null,
    });
    if (rpcErr) {
      return fail(rpcErr.message || "Error al registrar stock inicial");
    }
  }

  revalidatePath("/inventario");
  return ok({ id: newItem.id });
}

export async function updateItem(
  input: z.input<typeof updateItemSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      name: data.name,
      category: data.category,
      supplier: data.supplier?.trim() || null,
      min_stock: data.minStock,
      cost_per_unit: data.costPerUnit,
    })
    .eq("id", data.id);

  if (error) {
    return fail("Error al guardar cambios");
  }

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${data.id}`);
  return ok(undefined);
}

export async function registerMovement(
  input: z.input<typeof registerMovementSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = registerMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const isAdjustment = data.movementType.startsWith("adjustment");
  if (isAdjustment && !data.reason?.trim()) {
    return fail("El motivo es obligatorio para ajustes");
  }

  const supabase = await createSupabaseAdmin();

  // FIX 7: Usar fn_update_stock (Postgres function con FOR UPDATE) para
  // eliminar la race condition read→compute→write. Un único RPC atómico.
  const { error } = await supabase.rpc("fn_update_stock", {
    p_item_id: data.itemId,
    p_qty: data.quantity,
    p_movement_type: data.movementType,
    p_reason: data.reason?.trim() || null,
    p_actor_id: auth.user.id,
    p_unit_cost: data.unitCost ?? null,
    p_reference_type: null,
    p_reference_id: null,
  });

  if (error) {
    return fail(error.message || "Error al registrar movimiento");
  }

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${data.itemId}`);
  return ok(undefined);
}

export async function deactivateItem(
  input: z.input<typeof deactivateItemSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = deactivateItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("ID inválido");
  }

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("inventory_items")
    .update({ is_active: false })
    .eq("id", parsed.data.id);

  if (error) {
    return fail("Error al desactivar el insumo");
  }

  revalidatePath("/inventario");
  return ok(undefined);
}
