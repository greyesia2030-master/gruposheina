export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types/menus";
import { CreateRecipeButton } from "./create-recipe-button";
import type { MenuCategory } from "@/lib/types/database";
import { Search, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const CATEGORY_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABELS[c] })),
];

export default async function RecetasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const params   = await searchParams;
  const supabase = await createSupabaseServer();

  let query = supabase
    .from("recipes")
    .select("*, current_version:recipe_versions!inner(version, cost_per_portion, portions_yield)")
    .eq("recipe_versions.is_current", true)
    .order("name");

  if (params.search?.trim()) {
    query = query.ilike("name", `%${params.search.trim()}%`);
  }
  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category as MenuCategory);
  }

  const { data: recipes } = await query;
  const activeCategory = params.category ?? "all";

  return (
    <div>
      <PageHeader title="Recetas" action={<CreateRecipeButton />} />

      {/* Filtro por categoría */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {CATEGORY_OPTIONS.map((opt) => {
          const href =
            opt.key === "all"
              ? "/recetas" + (params.search ? `?search=${params.search}` : "")
              : `/recetas?category=${opt.key}${params.search ? `&search=${params.search}` : ""}`;
          return (
            <Link
              key={opt.key}
              href={href}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeCategory === opt.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Búsqueda */}
      <form method="GET" action="/recetas" className="mb-4">
        {params.category && params.category !== "all" && (
          <input type="hidden" name="category" value={params.category} />
        )}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            name="search"
            type="search"
            defaultValue={params.search ?? ""}
            placeholder="Buscar receta..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </form>

      {recipes && recipes.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Versión</th>
                  <th className="px-4 py-3 font-medium">Rendimiento</th>
                  <th className="px-4 py-3 text-right font-medium">Costo/porción</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => {
                  const version = Array.isArray(recipe.current_version)
                    ? recipe.current_version[0]
                    : recipe.current_version;
                  return (
                    <tr
                      key={recipe.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/recetas/${recipe.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {recipe.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="primary">
                          {CATEGORY_LABELS[recipe.category as MenuCategory] ?? recipe.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold">
                          v{version?.version ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {version?.portions_yield ?? "—"} porciones
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        ${(version?.cost_per_portion ?? 0).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={recipe.is_active ? "success" : "default"}>
                          {recipe.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={params.search || params.category ? "Sin resultados" : "Sin recetas"}
          description={
            params.search || params.category
              ? "Ninguna receta coincide con el filtro actual."
              : "Creá la primera receta para vincularla al menú."
          }
        />
      )}
    </div>
  );
}
