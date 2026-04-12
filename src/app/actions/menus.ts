"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getISOWeek, addDays } from "date-fns";
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
// createMenu
// ============================================================================

const createMenuSchema = z.object({
  weekStart: z
    .string()
    .min(1, "Seleccioná una fecha de inicio")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
});

export async function createMenu(
  input: z.input<typeof createMenuSchema>
): Promise<ActionResult<{ id: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = createMenuSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const start = new Date(parsed.data.weekStart + "T00:00:00");
  const end = addDays(start, 4);
  const weekNumber = getISOWeek(start);

  const supabase = await createSupabaseAdmin();
  const { data, error } = await supabase
    .from("weekly_menus")
    .insert({
      week_start: parsed.data.weekStart,
      week_end: end.toISOString().slice(0, 10),
      week_number: weekNumber,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) return fail("Error al crear menú");

  revalidatePath("/menus");
  return ok({ id: data.id });
}

// ============================================================================
// publishMenu
// ============================================================================

const publishMenuSchema = z.object({ menuId: z.string().uuid() });

export async function publishMenu(
  input: z.input<typeof publishMenuSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = publishMenuSchema.safeParse(input);
  if (!parsed.success) return fail("ID inválido");

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("weekly_menus")
    .update({ status: "published" })
    .eq("id", parsed.data.menuId);

  if (error) return fail("Error al publicar");

  revalidatePath("/menus");
  revalidatePath(`/menus/${parsed.data.menuId}`);
  return ok(undefined);
}

// ============================================================================
// duplicateMenu — copia items de un menú existente a una nueva semana
// ============================================================================

const duplicateMenuSchema = z.object({
  sourceMenuId: z.string().uuid(),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
});

export async function duplicateMenu(
  input: z.input<typeof duplicateMenuSchema>
): Promise<ActionResult<{ id: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = duplicateMenuSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const supabase = await createSupabaseAdmin();

  // 1. Crear nuevo menú
  const start = new Date(parsed.data.weekStart + "T00:00:00");
  const end = addDays(start, 4);
  const weekNumber = getISOWeek(start);

  const { data: newMenu, error: menuError } = await supabase
    .from("weekly_menus")
    .insert({
      week_start: parsed.data.weekStart,
      week_end: end.toISOString().slice(0, 10),
      week_number: weekNumber,
      status: "draft",
    })
    .select("id")
    .single();

  if (menuError || !newMenu) return fail("Error al crear menú destino");

  // 2. Copiar items
  const { data: sourceItems, error: itemsError } = await supabase
    .from("menu_items")
    .select("day_of_week, option_code, recipe_version_id, category, display_name, is_available")
    .eq("menu_id", parsed.data.sourceMenuId);

  if (itemsError) {
    await supabase.from("weekly_menus").delete().eq("id", newMenu.id);
    return fail("Error al leer menú origen");
  }

  if (sourceItems && sourceItems.length > 0) {
    const { error: insertError } = await supabase.from("menu_items").insert(
      sourceItems.map((item) => ({ ...item, menu_id: newMenu.id }))
    );
    if (insertError) {
      await supabase.from("weekly_menus").delete().eq("id", newMenu.id);
      return fail("Error al copiar opciones del menú");
    }
  }

  revalidatePath("/menus");
  return ok({ id: newMenu.id });
}

// ============================================================================
// Menu item mutations (add / update / delete)
// ============================================================================

const menuItemFieldSchema = z.object({
  itemId: z.string().uuid(),
  field: z.enum(["display_name", "category", "recipe_version_id", "is_available"]),
  value: z.union([z.string(), z.boolean(), z.null()]),
});

export async function updateMenuItemField(
  input: z.input<typeof menuItemFieldSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = menuItemFieldSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos");
  const { itemId, field, value } = parsed.data;

  // Validar el tipo concreto del valor según el campo
  if (field === "is_available" && typeof value !== "boolean") {
    return fail("Valor inválido para disponibilidad");
  }
  if (field === "category") {
    if (typeof value !== "string" || !CATEGORIES.includes(value as MenuCategory)) {
      return fail("Categoría inválida");
    }
  }
  if (field === "display_name" && (typeof value !== "string" || value.length > 200)) {
    return fail("Nombre inválido");
  }
  if (field === "recipe_version_id" && value !== null) {
    if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
      return fail("Receta inválida");
    }
  }

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("menu_items")
    .update({ [field]: value })
    .eq("id", itemId);

  if (error) return fail("Error al guardar");
  return ok(undefined);
}

const addMenuItemSchema = z.object({
  menuId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(5),
  optionCode: z.string().trim().min(1).max(4),
  category: z.enum(CATEGORIES),
  displayName: z.string().trim().min(1).max(200),
});

export async function addMenuItem(
  input: z.input<typeof addMenuItemSchema>
): Promise<ActionResult<{ id: string; option_code: string; day_of_week: number; display_name: string; category: MenuCategory; is_available: boolean; recipe_version_id: string | null; menu_id: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = addMenuItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const supabase = await createSupabaseAdmin();
  const { data: newItem, error } = await supabase
    .from("menu_items")
    .insert({
      menu_id: data.menuId,
      day_of_week: data.dayOfWeek,
      option_code: data.optionCode,
      category: data.category,
      display_name: data.displayName,
      is_available: true,
      recipe_version_id: null,
    })
    .select("*")
    .single();

  if (error || !newItem) return fail("Error al agregar opción");

  revalidatePath(`/menus/${data.menuId}`);
  return ok(newItem);
}

const deleteMenuItemSchema = z.object({ itemId: z.string().uuid() });

export async function deleteMenuItem(
  input: z.input<typeof deleteMenuItemSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = deleteMenuItemSchema.safeParse(input);
  if (!parsed.success) return fail("ID inválido");

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", parsed.data.itemId);

  if (error) return fail("Error al eliminar");
  return ok(undefined);
}
