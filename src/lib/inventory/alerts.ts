import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Retorna insumos activos cuyo stock está por debajo del mínimo.
 */
export async function getLowStockItems() {
  const supabase = await createSupabaseAdmin();

  // Supabase no soporta comparar dos columnas directamente,
  // así que traemos todos los activos y filtramos en JS
  const { data: items } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (items ?? []).filter((item) => item.current_stock < item.min_stock);
}

/**
 * Retorna recetas activas que usan un insumo dado en su versión vigente.
 */
export async function getItemsUsedInRecipes(itemId: string) {
  const supabase = await createSupabaseAdmin();

  const { data } = await supabase
    .from("recipe_ingredients")
    .select("recipe_version_id, recipe_version:recipe_versions!inner(recipe_id, is_current, recipe:recipes!inner(id, name, is_active))")
    .eq("inventory_item_id", itemId)
    .eq("recipe_versions.is_current", true)
    .eq("recipe_versions.recipes.is_active", true);

  return data ?? [];
}
