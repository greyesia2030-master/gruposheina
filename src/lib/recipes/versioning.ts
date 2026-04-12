import { createSupabaseAdmin } from "@/lib/supabase/server";

interface NewVersionInput {
  recipeId: string;
  ingredients: {
    inventoryItemId: string;
    quantity: number;
    unit: string;
    substituteItemId?: string | null;
  }[];
  portionsYield: number;
  preparationNotes: string | null;
  actorId: string;
}

/**
 * Crea una nueva versión inmutable de una receta.
 * - Marca la versión actual como is_current = false
 * - Crea nueva recipe_version con version = max + 1
 * - Copia los ingredientes con las modificaciones
 * - El trigger de la DB recalcula cost_per_portion
 */
export async function createNewVersion(input: NewVersionInput) {
  const supabase = await createSupabaseAdmin();

  // Obtener versión actual
  const { data: currentVersion } = await supabase
    .from("recipe_versions")
    .select("version")
    .eq("recipe_id", input.recipeId)
    .eq("is_current", true)
    .single();

  const nextVersion = (currentVersion?.version ?? 0) + 1;

  // Desmarcar versión actual
  await supabase
    .from("recipe_versions")
    .update({ is_current: false })
    .eq("recipe_id", input.recipeId)
    .eq("is_current", true);

  // Crear nueva versión
  const { data: newVersion, error: versionError } = await supabase
    .from("recipe_versions")
    .insert({
      recipe_id: input.recipeId,
      version: nextVersion,
      portions_yield: input.portionsYield,
      preparation_notes: input.preparationNotes,
      cost_per_portion: 0, // Se recalcula con el trigger
      is_current: true,
      created_by: input.actorId,
    })
    .select()
    .single();

  if (versionError || !newVersion) {
    throw new Error(`Error creando versión: ${versionError?.message}`);
  }

  // Insertar ingredientes
  if (input.ingredients.length > 0) {
    const { error: ingError } = await supabase.from("recipe_ingredients").insert(
      input.ingredients.map((ing) => ({
        recipe_version_id: newVersion.id,
        inventory_item_id: ing.inventoryItemId,
        quantity: ing.quantity,
        unit: ing.unit,
        substitute_item_id: ing.substituteItemId ?? null,
      }))
    );

    if (ingError) {
      throw new Error(`Error insertando ingredientes: ${ingError.message}`);
    }
  }

  return newVersion;
}
