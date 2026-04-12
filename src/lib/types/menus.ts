import type {
  WeeklyMenu,
  MenuItem,
  MenuCategory,
  MenuStatus,
  Recipe,
  RecipeVersion,
} from "./database";

export interface MenuWithItems extends WeeklyMenu {
  items: MenuItem[];
}

// Item de menú con la info de receta resuelta
export interface MenuItemWithRecipe extends MenuItem {
  recipe: Pick<Recipe, "id" | "name"> | null;
  recipe_version: Pick<
    RecipeVersion,
    "id" | "version" | "cost_per_portion" | "portions_yield"
  > | null;
}

// Menú semanal completo con items + recetas (vista editor)
export interface WeeklyMenuWithItems extends WeeklyMenu {
  items: MenuItemWithRecipe[];
}

// Input para crear un menú semanal nuevo
export interface CreateMenuInput {
  week_start: string; // YYYY-MM-DD (lunes)
  week_end: string;   // YYYY-MM-DD (viernes)
  week_number: number;
  status?: MenuStatus;
  items?: Array<{
    day_of_week: number;
    option_code: string;
    category: MenuCategory;
    display_name: string;
    recipe_version_id?: string | null;
  }>;
}

// Input para actualizar un item del menú
export interface UpdateMenuItemInput {
  id: string;
  display_name?: string;
  recipe_version_id?: string | null;
  category?: MenuCategory;
  is_available?: boolean;
}

export interface MenuDayItems {
  day: number;
  dayName: string;
  items: MenuItem[];
}

export const MENU_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export const MENU_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  principal: "Principal",
  alternativa: "Alternativa",
  sandwich: "Sándwich",
  tarta: "Tarta",
  ensalada: "Ensalada",
  veggie: "Veggie",
  especial: "Especial",
};

export const CATEGORY_ORDER: MenuCategory[] = [
  "principal",
  "alternativa",
  "sandwich",
  "tarta",
  "ensalada",
  "veggie",
  "especial",
];
