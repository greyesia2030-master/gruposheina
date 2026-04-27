import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { canViewCost } from "@/lib/permissions";
import { INV_CATEGORY_LABELS, MOVEMENT_TYPE_LABELS } from "@/lib/types/inventory";
import { RegisterMovement } from "./register-movement";
import { EditItemForm } from "./edit-item-form";
import { DeactivateItemButton } from "./deactivate-item-button";
import { AlertTriangle } from "lucide-react";
import type { InventoryItem, InventoryMovement } from "@/lib/types/database";
import { formatART } from "@/lib/utils/timezone";

const MOVEMENT_BADGE_VARIANT: Record<
  string,
  "success" | "danger" | "warning" | "info" | "default"
> = {
  purchase:               "success",
  production_consumption: "danger",
  waste:                  "warning",
  adjustment_pos:         "info",
  adjustment_neg:         "info",
  return:                 "default",
};

export default async function InventarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supabase, currentUser] = await Promise.all([
    createSupabaseServer(),
    requireUser(),
  ]);
  const showCost = canViewCost(currentUser.role);

  const { data: itemData } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .single();

  if (!itemData) notFound();
  const item = itemData as InventoryItem;

  // Movimientos (últimos 50, más reciente primero)
  const { data: movData } = await supabase
    .from("inventory_movements")
    .select("*, actor:users(full_name)")
    .eq("item_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const movements = (movData ?? []) as (InventoryMovement & {
    actor: { full_name: string } | null;
  })[];

  // Recetas activas que usan este insumo en la versión vigente
  const { data: recipeIngData } = await supabase
    .from("recipe_ingredients")
    .select(
      "recipe_version:recipe_versions!inner(is_current, recipe:recipes!inner(id, name, is_active))"
    )
    .eq("inventory_item_id", id);

  // FK singular → PostgREST devuelve objeto, no array
  type RecipeRow = {
    recipe_version: {
      is_current: boolean;
      recipe: { id: string; name: string; is_active: boolean } | null;
    } | null;
  };

  const activeRecipes: { name: string; recipeId: string }[] = [];
  const seen = new Set<string>();
  for (const row of (recipeIngData ?? []) as unknown as RecipeRow[]) {
    const rv = row.recipe_version;
    const recipe = rv?.recipe;
    if (rv?.is_current && recipe?.is_active && !seen.has(recipe.id)) {
      seen.add(recipe.id);
      activeRecipes.push({ name: recipe.name, recipeId: recipe.id });
    }
  }

  const isLow = item.current_stock < item.min_stock;

  return (
    <div>
      <PageHeader
        title={item.name}
        breadcrumbs={[
          { label: "Inventario", href: "/inventario" },
          { label: item.name },
        ]}
        action={
          <Badge variant="primary">
            {INV_CATEGORY_LABELS[item.category] ?? item.category}
          </Badge>
        }
      />

      {/* Stat cards */}
      <div className={`mb-6 grid gap-4 ${showCost ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-text-secondary">Stock actual</p>
            <p className={`text-2xl font-bold ${isLow ? "text-error" : ""}`}>
              {item.current_stock}{" "}
              <span className="text-base font-normal text-text-secondary">
                {item.unit}
              </span>
            </p>
            {isLow && (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-error">
                <AlertTriangle className="h-3 w-3" />
                Bajo mínimo ({item.min_stock})
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-text-secondary">Stock mínimo</p>
            <p className="text-2xl font-bold">
              {item.min_stock}{" "}
              <span className="text-base font-normal text-text-secondary">
                {item.unit}
              </span>
            </p>
          </div>
        </Card>
        {showCost && (
          <Card>
            <div className="p-4 text-center">
              <p className="text-xs text-text-secondary">Costo por unidad</p>
              <p className="text-2xl font-bold text-primary">
                $
                {item.cost_per_unit.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </Card>
        )}
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-text-secondary">En recetas activas</p>
            <p className="text-2xl font-bold">{activeRecipes.length}</p>
          </div>
        </Card>
      </div>

      {/* Editar datos del insumo */}
      <EditItemForm item={item} />

      {/* Registrar movimiento */}
      <div className="mt-6">
        <RegisterMovement itemId={item.id} currentCostPerUnit={item.cost_per_unit} />
      </div>

      {/* Historial de movimientos */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Historial de movimientos</h2>
        {movements.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                    <th className="px-4 py-3 font-medium text-right">Costo/ud</th>
                    <th className="px-4 py-3 font-medium text-right">Stock result.</th>
                    <th className="px-4 py-3 font-medium">Motivo</th>
                    <th className="px-4 py-3 font-medium">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => (
                    <tr
                      key={mov.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 text-text-secondary">
                        {formatART(mov.created_at, "dd MMM HH:mm")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            MOVEMENT_BADGE_VARIANT[mov.movement_type] ?? "default"
                          }
                        >
                          {MOVEMENT_TYPE_LABELS[
                            mov.movement_type as keyof typeof MOVEMENT_TYPE_LABELS
                          ] ?? mov.movement_type}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          mov.quantity > 0 ? "text-success" : "text-error"
                        }`}
                      >
                        {mov.quantity > 0 ? "+" : ""}
                        {mov.quantity}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {mov.unit_cost != null
                          ? `$${mov.unit_cost.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {mov.stock_after}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {mov.reason ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {(mov.actor as unknown as { full_name: string } | null)?.full_name ?? "Sistema"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="p-6 text-center text-text-secondary">
              Sin movimientos registrados
            </p>
          </Card>
        )}
      </div>

      {/* Footer: desactivar insumo */}
      <div className="mt-8 flex justify-end border-t border-border pt-4">
        <DeactivateItemButton
          itemId={item.id}
          itemName={item.name}
          activeRecipes={activeRecipes}
        />
      </div>
    </div>
  );
}
