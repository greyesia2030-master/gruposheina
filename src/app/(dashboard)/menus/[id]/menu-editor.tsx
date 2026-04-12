"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types/menus";
import { DAY_NAMES } from "@/lib/types/orders";
import { getNextOptionCode } from "@/hooks/use-menus";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import type { MenuItem, MenuCategory, MenuStatus } from "@/lib/types/database";

interface RecipeOption {
  versionId: string;
  recipeId: string;
  name: string;
  category: string;
}

interface MenuEditorProps {
  menuId: string;
  menuStatus: MenuStatus;
  items: MenuItem[];
  recipeOptions: RecipeOption[];
}

const DAYS = [1, 2, 3, 4, 5] as const;

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((cat) => ({
  value: cat,
  label: CATEGORY_LABELS[cat],
}));

const DEBOUNCE_MS = 500;

export function MenuEditor({ menuId, menuStatus, items: initialItems, recipeOptions }: MenuEditorProps) {
  const [activeDay, setActiveDay] = useState<number>(1);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [savedId, setSavedId] = useState<string | null>(null); // muestra ✓ por 1.5s
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  const dayItems = items.filter((item) => item.day_of_week === activeDay);
  const isEditable = menuStatus !== "archived";

  // ── Auto-save con debounce ────────────────────────────────────────────────

  const saveField = useCallback(
    (itemId: string, field: string, value: string | boolean | null) => {
      // Actualizar estado local inmediatamente
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i))
      );

      // Cancelar el timer previo para este item+field
      const key = `${itemId}:${field}`;
      const prev = debounceRef.current.get(key);
      if (prev) clearTimeout(prev);

      const timer = setTimeout(async () => {
        debounceRef.current.delete(key);
        const { error } = await supabase
          .from("menu_items")
          .update({ [field]: value })
          .eq("id", itemId);

        if (error) {
          toast("Error al guardar", "error");
        } else {
          setSavedId(itemId);
          setTimeout(() => setSavedId(null), 1500);
        }
      }, DEBOUNCE_MS);

      debounceRef.current.set(key, timer);
    },
    [supabase, toast]
  );

  // ── Agregar opción ────────────────────────────────────────────────────────

  async function addItem() {
    const dayCount = items.filter((i) => i.day_of_week === activeDay).length;
    const optionCode = getNextOptionCode(activeDay, dayCount);

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        menu_id: menuId,
        day_of_week: activeDay,
        option_code: optionCode,
        category: "principal" as MenuCategory,
        display_name: "Nueva opción",
        is_available: true,
        recipe_version_id: null,
      })
      .select()
      .single();

    if (error) {
      toast("Error al agregar opción", "error");
    } else if (data) {
      setItems((prev) => [...prev, data]);
      toast(`Opción ${optionCode} agregada`, "success");
    }
  }

  // ── Eliminar opción ───────────────────────────────────────────────────────

  async function removeItem(itemId: string) {
    if (!confirm("¿Eliminar esta opción? Esta acción no se puede deshacer.")) return;

    const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
    if (error) {
      toast("Error al eliminar", "error");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast("Opción eliminada", "success");
    }
  }

  // ── Publicar menú ─────────────────────────────────────────────────────────

  async function publishMenu() {
    const { error } = await supabase
      .from("weekly_menus")
      .update({ status: "published" as MenuStatus })
      .eq("id", menuId);

    if (error) {
      toast("Error al publicar", "error");
    } else {
      toast("Menú publicado ✓", "success");
      router.refresh();
    }
  }

  return (
    <div>
      {/* Barra superior */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-32">
          {/* Estado de auto-guardado */}
          <p className="text-xs text-text-secondary animate-pulse">
            {debounceRef.current.size > 0 ? "Guardando cambios…" : ""}
          </p>
        </div>
        {menuStatus === "draft" && (
          <Button size="sm" onClick={publishMenu}>
            Publicar menú
          </Button>
        )}
      </div>

      {/* Pestañas de días */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {DAYS.map((day) => {
          const count = items.filter((i) => i.day_of_week === day).length;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeDay === day
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {DAY_NAMES[day]}{" "}
              <span className="text-xs">({count}/7)</span>
            </button>
          );
        })}
      </div>

      {/* Tabla de opciones del día */}
      <Card>
        {dayItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="w-16 px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Nombre del plato</th>
                  <th className="w-40 px-4 py-3 font-medium">Categoría</th>
                  <th className="w-64 px-4 py-3 font-medium">Receta vinculada</th>
                  <th className="w-20 px-4 py-3 text-center font-medium">Disp.</th>
                  {isEditable && <th className="w-16 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {dayItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    {/* Código */}
                    <td className="px-4 py-2 font-mono font-bold text-primary">
                      <span className="flex items-center gap-1">
                        {item.option_code}
                        {savedId === item.id && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        )}
                      </span>
                    </td>

                    {/* Nombre */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <Input
                          defaultValue={item.display_name}
                          onChange={(e) => saveField(item.id, "display_name", e.target.value)}
                          className="!py-1 text-sm"
                        />
                      ) : (
                        item.display_name
                      )}
                    </td>

                    {/* Categoría */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <Select
                          options={CATEGORY_OPTIONS}
                          value={item.category}
                          onChange={(e) => saveField(item.id, "category", e.target.value)}
                          className="!py-1 text-sm"
                        />
                      ) : (
                        CATEGORY_LABELS[item.category]
                      )}
                    </td>

                    {/* Receta (recipe_version_id) */}
                    <td className="px-4 py-2">
                      {isEditable ? (
                        <Select
                          options={recipeOptions.map((r) => ({
                            value: r.versionId,
                            label: r.name,
                          }))}
                          value={item.recipe_version_id ?? ""}
                          placeholder="Sin receta"
                          onChange={(e) =>
                            saveField(
                              item.id,
                              "recipe_version_id",
                              e.target.value || null
                            )
                          }
                          className="!py-1 text-sm"
                        />
                      ) : (
                        recipeOptions.find((r) => r.versionId === item.recipe_version_id)?.name ?? "—"
                      )}
                    </td>

                    {/* Disponible */}
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.is_available}
                        disabled={!isEditable}
                        onChange={(e) => saveField(item.id, "is_available", e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded accent-primary"
                      />
                    </td>

                    {/* Eliminar */}
                    {isEditable && (
                      <td className="px-4 py-2">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="rounded p-1 text-text-secondary transition-colors hover:bg-red-50 hover:text-error"
                          title="Eliminar opción"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-text-secondary">
            Sin opciones para {DAY_NAMES[activeDay]}. Agregá la primera con el botón de abajo.
          </p>
        )}

        {isEditable && (
          <div className="border-t border-border p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={addItem}
              disabled={dayItems.length >= 7}
              title={dayItems.length >= 7 ? "Máximo 7 opciones por día" : ""}
            >
              <Plus className="h-4 w-4" />
              Agregar opción
              {dayItems.length >= 7 && (
                <span className="ml-1 text-xs text-text-secondary">(máx. 7)</span>
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
