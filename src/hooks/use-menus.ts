"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { WeeklyMenu, MenuItem, MenuStatus } from "@/lib/types/database";

// ── useMenus: lista de menús con filtros opcionales ───────────────────────────

export function useMenus(statusFilter?: MenuStatus) {
  const supabase = createBrowserClient();
  const [menus, setMenus] = useState<(WeeklyMenu & { itemCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("weekly_menus")
      .select("*, items:menu_items(id)")
      .order("week_start", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setMenus(
        (data ?? []).map((m) => ({
          ...m,
          itemCount: (m.items as { id: string }[])?.length ?? 0,
        }))
      );
    }
    setLoading(false);
  }, [supabase, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return { menus, loading, error, reload: load };
}

// ── useMenu: menú individual con items y operaciones CRUD ─────────────────────

export function useMenu(menuId: string) {
  const supabase = createBrowserClient();
  const router = useRouter();
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [menuRes, itemsRes] = await Promise.all([
      supabase.from("weekly_menus").select("*").eq("id", menuId).single(),
      supabase
        .from("menu_items")
        .select("*")
        .eq("menu_id", menuId)
        .order("day_of_week")
        .order("option_code"),
    ]);
    setMenu(menuRes.data ?? null);
    setItems(itemsRes.data ?? []);
    setLoading(false);
  }, [supabase, menuId]);

  useEffect(() => { load(); }, [load]);

  const updateMenuItem = useCallback(
    async (itemId: string, fields: Partial<MenuItem>) => {
      const { error } = await supabase
        .from("menu_items")
        .update(fields)
        .eq("id", itemId);
      if (!error) setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...fields } : i)));
      return error;
    },
    [supabase]
  );

  const deleteMenuItem = useCallback(
    async (itemId: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
      if (!error) setItems((prev) => prev.filter((i) => i.id !== itemId));
      return error;
    },
    [supabase]
  );

  const publishMenu = useCallback(async () => {
    const { error } = await supabase
      .from("weekly_menus")
      .update({ status: "published" as MenuStatus })
      .eq("id", menuId);
    if (!error && menu) setMenu({ ...menu, status: "published" });
    return error;
  }, [supabase, menuId, menu]);

  return { menu, items, loading, updateMenuItem, deleteMenuItem, publishMenu, reload: load };
}

// ── Helpers de códigos de opción ──────────────────────────────────────────────

// Offsets según CLAUDE.md: A-G lunes, H-N martes, O-U miércoles, V-BB jueves, CC-II viernes
const DAY_CODE_OFFSETS: Record<number, number> = { 1: 0, 2: 7, 3: 14, 4: 21, 5: 28 };

export function getNextOptionCode(dayOfWeek: number, existingCount: number): string {
  const offset = DAY_CODE_OFFSETS[dayOfWeek] ?? 0;
  const n = offset + existingCount;
  if (n < 26) return String.fromCharCode(65 + n);
  // Doble letra: AA, BB, CC... (según el esquema de Sheina)
  const letter = String.fromCharCode(65 + (n - 26));
  return letter + letter;
}
