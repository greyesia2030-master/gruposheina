import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { canViewCost } from "@/lib/permissions";
import { CATEGORY_LABELS } from "@/lib/types/menus";
import { RecipeIngredients } from "./recipe-ingredients";
import { formatART } from "@/lib/utils/timezone";

export default async function RecetaDetailPage({
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

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (!recipe) notFound();

  // Versión actual con ingredientes
  const { data: currentVersion } = await supabase
    .from("recipe_versions")
    .select("*, ingredients:recipe_ingredients(*, item:inventory_items(name, unit, cost_per_unit))")
    .eq("recipe_id", id)
    .eq("is_current", true)
    .single();

  // Todas las versiones con el creador
  const { data: versions } = await supabase
    .from("recipe_versions")
    .select("id, version, cost_per_portion, portions_yield, is_current, created_at, creator:users(full_name)")
    .eq("recipe_id", id)
    .order("version", { ascending: false });

  // Insumos disponibles (para el formulario)
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, name, unit, cost_per_unit")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader
        title={recipe.name}
        breadcrumbs={[
          { label: "Recetas", href: "/recetas" },
          { label: recipe.name },
        ]}
        action={
          <Badge variant="primary">
            {CATEGORY_LABELS[recipe.category as keyof typeof CATEGORY_LABELS] ?? recipe.category}
          </Badge>
        }
      />

      {!currentVersion && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Sin versión activa</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Esta receta no tiene versión con ingredientes. Agregá al menos 1 ingrediente para publicarla.
          </p>
        </div>
      )}

      {/* Info principal */}
      <div className={`mb-6 grid gap-4 ${showCost ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-text-secondary">Versión actual</p>
            <p className="text-2xl font-bold">v{currentVersion?.version ?? "—"}</p>
          </div>
        </Card>
        {showCost && (
          <Card>
            <div className="p-4 text-center">
              <p className="text-xs text-text-secondary">Costo por porción</p>
              <p className="text-2xl font-bold text-primary">
                ${(currentVersion?.cost_per_portion ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </Card>
        )}
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-text-secondary">Rendimiento</p>
            <p className="text-2xl font-bold">{currentVersion?.portions_yield ?? "—"} porciones</p>
          </div>
        </Card>
      </div>

      {/* Ingredientes editables */}
      <RecipeIngredients
        recipeId={recipe.id}
        currentVersion={currentVersion}
        inventoryItems={inventoryItems ?? []}
      />

      {/* Notas de preparación */}
      {currentVersion?.preparation_notes && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Notas de preparación</h2>
          <Card>
            <p className="whitespace-pre-wrap p-4 text-sm">{currentVersion.preparation_notes}</p>
          </Card>
        </div>
      )}

      {/* Historial de versiones */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Historial de versiones</h2>
        {versions && versions.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Versión</th>
                    <th className="px-4 py-3 font-medium">Rendimiento</th>
                    {showCost && <th className="px-4 py-3 text-right font-medium">Costo/porción</th>}
                    <th className="px-4 py-3 font-medium">Creada por</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => {
                    const creator = (v.creator as unknown as { full_name: string } | null) ?? null;
                    return (
                      <tr key={v.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-mono font-bold">v{v.version}</td>
                        <td className="px-4 py-3 text-text-secondary">{v.portions_yield} porciones</td>
                        {showCost && (
                          <td className="px-4 py-3 text-right font-semibold">
                            ${(v.cost_per_portion ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </td>
                        )}
                        <td className="px-4 py-3 text-text-secondary">{creator?.full_name ?? "—"}</td>
                        <td className="px-4 py-3 text-text-secondary">
                          {formatART(v.created_at, "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3">
                          {v.is_current && <Badge variant="success">Actual</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="p-6 text-center text-text-secondary">Sin versiones</p>
          </Card>
        )}
      </div>
    </div>
  );
}
