import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { MENU_STATUS_LABELS } from "@/lib/types/menus";
import { MenuEditor } from "./menu-editor";
import { formatART } from "@/lib/utils/timezone";

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: menu } = await supabase
    .from("weekly_menus")
    .select("*")
    .eq("id", id)
    .single();

  if (!menu) notFound();

  // Cargar items del menú
  const { data: items } = await supabase
    .from("menu_items")
    .select("*")
    .eq("menu_id", id)
    .order("day_of_week")
    .order("option_code");

  // Cargar versiones actuales de recetas activas (con el nombre de la receta)
  // menu_items.recipe_version_id apunta a recipe_versions.id, no a recipes.id
  const { data: recipeVersions } = await supabase
    .from("recipe_versions")
    .select("id, recipe:recipes!inner(id, name, category, is_active)")
    .eq("is_current", true);

  // PostgREST devuelve objeto (no array) para FK many-to-one (recipe_versions.recipe_id → recipes.id).
  // Se maneja ambos casos por defensividad.
  const recipeOptions = (recipeVersions ?? [])
    .map((rv) => {
      const raw = rv.recipe;
      const recipe = (Array.isArray(raw) ? raw[0] : raw) as {
        id: string;
        name: string;
        category: string;
        is_active: boolean;
      } | null | undefined;
      if (!recipe?.id || !recipe.is_active) return null;
      return { versionId: rv.id, recipeId: recipe.id, name: recipe.name, category: recipe.category };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const statusVariant =
    menu.status === "published" ? "success" : menu.status === "archived" ? "warning" : "default";
  const weekRange = `${formatART(menu.week_start + "T12:00:00Z", "dd MMM")} — ${formatART(menu.week_end + "T12:00:00Z", "dd MMM")}`;

  return (
    <div>
      <PageHeader
        title={`Menú — ${weekRange}`}
        breadcrumbs={[
          { label: "Menús", href: "/menus" },
          { label: weekRange },
        ]}
        action={
          <Badge variant={statusVariant}>
            {MENU_STATUS_LABELS[menu.status] ?? menu.status}
          </Badge>
        }
      />

      <MenuEditor
        menuId={menu.id}
        menuStatus={menu.status}
        items={items ?? []}
        recipeOptions={recipeOptions}
      />
    </div>
  );
}
