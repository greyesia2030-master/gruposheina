"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { parseISO, addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types/menus";
import { DAY_NAMES } from "@/lib/types/orders";
import { getNextOptionCode } from "@/hooks/use-menus";
import {
  addMenuItem,
  deleteMenuItem,
  publishMenu as publishMenuAction,
  updateMenuItemField,
} from "@/app/actions/menus";
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
  weekStart: string; // "YYYY-MM-DD" — Monday of the week
}

const DAYS = [1, 2, 3, 4, 5] as const;

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((cat) => ({
  value: cat,
  label: CATEGORY_LABELS[cat],
}));

const DEBOUNCE_MS = 500;

export function MenuEditor({ menuId, menuStatus, items: initialItems, recipeOptions, weekStart }: MenuEditorProps) {
  const [activeDay, setActiveDay] = useState<number>(1);

  // Pre-compute actual calendar dates for each day tab (Monday + offset)
  const dayDates = useMemo(() => {
    try {
      const monday = parseISO(weekStart + 'T12:00:00');
      return Object.fromEntries(
        ([1, 2, 3, 4, 5] as const).map((d) => [
          d,
          format(addDays(monday, d - 1), 'd MMM', { locale: es }),
        ])
      ) as Record<1 | 2 | 3 | 4 | 5, string>;
    } catch {
      return {} as Record<1 | 2 | 3 | 4 | 5, string>;
    }
  }, [weekStart]);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [savedId, setSavedId] = useState<string | null>(null); // muestra ✓ por 1.5s
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const router = useRouter();
  const { toast } = useToast();

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
        const result = await updateMenuItemField({
          itemId,
          field: field as "display_name" | "category" | "recipe_version_id" | "is_available",
          value,
        });

        if (!result.ok) {
          toast(result.error, "error");
        } else {
          setSavedId(itemId);
          setTimeout(() => setSavedId(null), 1500);
        }
      }, DEBOUNCE_MS);

      debounceRef.current.set(key, timer);
    },
    [toast]
  );

  // ── Agregar opción ────────────────────────────────────────────────────────

  async function addItem() {
    const dayCount = items.filter((i) => i.day_of_week === activeDay).length;
    const optionCode = getNextOptionCode(activeDay, dayCount);

    const result = await addMenuItem({
      menuId,
      dayOfWeek: activeDay,
      optionCode,
      category: "principal" as MenuCategory,
      displayName: "Nueva opción",
    });

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setItems((prev) => [...prev, result.data as MenuItem]);
    toast(`Opción ${optionCode} agregada`, "success");
  }

  // ── Eliminar opción ───────────────────────────────────────────────────────

  async function removeItem(itemId: string) {
    if (!confirm("¿Eliminar esta opción? Esta acción no se puede deshacer.")) return;

    const result = await deleteMenuItem({ itemId });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast("Opción eliminada", "success");
  }

  // ── Publicar menú ─────────────────────────────────────────────────────────

  async function publishMenu() {
    const result = await publishMenuAction({ menuId });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Menú publicado ✓", "success");
    router.refresh();
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
              {DAY_NAMES[day]}
              {dayDates[day as 1 | 2 | 3 | 4 | 5] && (
                <span className="ml-1 text-xs opacity-70">{dayDates[day as 1 | 2 | 3 | 4 | 5]}</span>
              )}{" "}
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
