"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-user";
import { CATEGORY_ORDER } from "@/lib/types/menus";
import type { MenuCategory } from "@/lib/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

async function handleAuth() {
  try {
    const user = await requireAdmin();
    return { ok: true as const, user };
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    return fail("Error de autenticación");
  }
}

const CATEGORIES = CATEGORY_ORDER as [MenuCategory, ...MenuCategory[]];

// ============================================================================
// createRecipe — también crea la versión 1
// ============================================================================

const createRecipeSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(150),
  category: z.enum(CATEGORIES),
  portions: z.coerce
    .number()
    .int()
    .min(1, "El rendimiento debe ser al menos 1")
    .max(10000),
});

export async function createRecipe(
  input: z.input<typeof createRecipeSchema>
): Promise<ActionResult<{ id: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = createRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const supabase = await createSupabaseAdmin();
  const { data: recipe, error: rErr } = await supabase
    .from("recipes")
    .insert({
      name: data.name,
      category: data.category,
      is_active: true,
    })
    .select("id")
    .single();

  if (rErr || !recipe) return fail("Error al crear la receta");

  const { error: vErr } = await supabase.from("recipe_versions").insert({
    recipe_id: recipe.id,
    version: 1,
    portions_yield: data.portions,
    cost_per_portion: 0,
    is_current: true,
    preparation_notes: null,
    created_by: auth.user.id,
  });

  if (vErr) {
    // Rollback: eliminar la receta huérfana.
    await supabase.from("recipes").delete().eq("id", recipe.id);
    return fail("Error al crear la versión inicial");
  }

  revalidatePath("/recetas");
  return ok({ id: recipe.id });
}

// ============================================================================
// updateNotesOnly — patch de preparation_notes sin crear versión
// ============================================================================

const updateNotesSchema = z.object({
  versionId: z.string().uuid(),
  notes: z.string().trim().max(5000).nullable(),
});

export async function updateRecipeVersionNotes(
  input: z.input<typeof updateNotesSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = updateNotesSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("recipe_versions")
    .update({ preparation_notes: parsed.data.notes || null })
    .eq("id", parsed.data.versionId);

  if (error) return fail("Error al guardar las notas");

  revalidatePath("/recetas");
  return ok(undefined);
}

// ============================================================================
// createRecipeVersion — nueva versión con ingredientes (append-only)
// ============================================================================

const ingredientSchema = z.object({
  inventoryItemId: z.string().uuid("Seleccioná un insumo"),
  quantity: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
  unit: z.string().trim().max(20),
  substituteItemId: z.string().uuid().nullable().optional(),
});

const createVersionSchema = z.object({
  recipeId: z.string().uuid(),
  currentVersionId: z.string().uuid().nullable(),
  version: z.number().int().min(1),
  portionsYield: z.coerce.number().int().min(1).max(10000),
  notes: z.string().trim().max(5000).nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1, "Agregá al menos un ingrediente"),
});

export async function createRecipeVersion(
  input: z.input<typeof createVersionSchema>
): Promise<ActionResult<{ versionId: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = createVersionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const supabase = await createSupabaseAdmin();

  // 1. Desmarcar versión actual (si hay)
  if (data.currentVersionId) {
    const { error: uErr } = await supabase
      .from("recipe_versions")
      .update({ is_current: false })
      .eq("id", data.currentVersionId);
    if (uErr) return fail("No se pudo archivar la versión anterior");
  }

  // 2. Crear nueva versión — el trigger trg_recipe_ingredients_cost
  //    recalculará cost_per_portion automáticamente cuando insertemos los
  //    ingredientes, así que basta con dejarlo en 0 aquí.
  const { data: newVersion, error: vErr } = await supabase
    .from("recipe_versions")
    .insert({
      recipe_id: data.recipeId,
      version: data.version,
      portions_yield: data.portionsYield,
      preparation_notes: data.notes || null,
      cost_per_portion: 0,
      is_current: true,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (vErr || !newVersion) return fail("Error creando la versión");

  // 3. Insertar ingredientes (triggerea el recálculo de costo)
  const { error: iErr } = await supabase.from("recipe_ingredients").insert(
    data.ingredients.map((ing) => ({
      recipe_version_id: newVersion.id,
      inventory_item_id: ing.inventoryItemId,
      quantity: ing.quantity,
      unit: ing.unit,
      substitute_item_id: ing.substituteItemId || null,
    }))
  );

  if (iErr) {
    // Rollback best-effort
    await supabase.from("recipe_versions").delete().eq("id", newVersion.id);
    if (data.currentVersionId) {
      await supabase
        .from("recipe_versions")
        .update({ is_current: true })
        .eq("id", data.currentVersionId);
    }
    return fail("Error guardando ingredientes");
  }

  revalidatePath("/recetas");
  revalidatePath(`/recetas/${data.recipeId}`);
  return ok({ versionId: newVersion.id });
}
