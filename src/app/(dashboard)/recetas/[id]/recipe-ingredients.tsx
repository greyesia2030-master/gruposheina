"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { calculateCostPerPortion } from "@/lib/recipes/cost-calculator";
import { Plus, Trash2, Save } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Ingredient {
  id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
  substitute_item_id: string | null;
  item: { name: string; unit: string; cost_per_unit: number } | null;
}

interface VersionData {
  id: string;
  version: number;
  portions_yield: number;
  preparation_notes: string | null;
  ingredients: Ingredient[];
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
}

interface LocalIngredient {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  substituteItemId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ingredientsChanged(
  original: Ingredient[],
  local: LocalIngredient[],
  portionsYield: number,
  originalYield: number
): boolean {
  if (portionsYield !== originalYield) return true;
  if (original.length !== local.length) return true;
  return original.some((orig, i) => {
    const loc = local[i];
    return (
      orig.inventory_item_id !== loc.inventoryItemId ||
      orig.quantity !== loc.quantity ||
      orig.substitute_item_id !== loc.substituteItemId
    );
  });
}

// ── Componente ────────────────────────────────────────────────────────────────

export function RecipeIngredients({
  recipeId,
  currentVersion,
  inventoryItems,
}: {
  recipeId: string;
  currentVersion: VersionData | null;
  inventoryItems: InventoryItem[];
}) {
  const [ingredients, setIngredients] = useState<LocalIngredient[]>(
    currentVersion?.ingredients.map((ing) => ({
      inventoryItemId: ing.inventory_item_id,
      quantity: ing.quantity,
      unit: ing.unit,
      costPerUnit: ing.item?.cost_per_unit ?? 0,
      substituteItemId: ing.substitute_item_id ?? null,
    })) ?? []
  );
  const [portionsYield, setPortionsYield] = useState(currentVersion?.portions_yield ?? 10);
  const [notes, setNotes] = useState(currentVersion?.preparation_notes ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const router   = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  const itemOptions = inventoryItems.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.unit})`,
  }));

  const substitueOptions = [
    { value: "", label: "Sin sustituto" },
    ...itemOptions,
  ];

  const totalCost = ingredients.reduce((sum, ing) => sum + ing.quantity * ing.costPerUnit, 0);
  const costPerPortion = calculateCostPerPortion(
    ingredients.map((i) => ({ quantity: i.quantity, costPerUnit: i.costPerUnit })),
    portionsYield
  );

  // ¿Los ingredientes o rendimiento cambiaron? → nueva versión; si solo notas → patch
  const needsNewVersion = useMemo(() => {
    if (!currentVersion) return true;
    return ingredientsChanged(
      currentVersion.ingredients,
      ingredients,
      portionsYield,
      currentVersion.portions_yield
    );
  }, [currentVersion, ingredients, portionsYield]);

  const nextVersion = (currentVersion?.version ?? 0) + 1;

  function addIngredient() {
    setIngredients([
      ...ingredients,
      { inventoryItemId: "", quantity: 0, unit: "", costPerUnit: 0, substituteItemId: null },
    ]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(index: number, field: keyof LocalIngredient, value: string | number | null) {
    setIngredients(
      ingredients.map((ing, i) => {
        if (i !== index) return ing;
        const updated = { ...ing, [field]: value };
        if (field === "inventoryItemId") {
          const item = inventoryItems.find((it) => it.id === value);
          if (item) {
            updated.unit = item.unit;
            updated.costPerUnit = item.cost_per_unit;
          }
        }
        return updated;
      })
    );
  }

  function handleSaveClick() {
    if (ingredients.some((ing) => !ing.inventoryItemId || ing.quantity <= 0)) {
      toast("Completá todos los ingredientes antes de guardar.", "error");
      return;
    }
    if (needsNewVersion) {
      setConfirmOpen(true); // mostrar Dialog de confirmación
    } else {
      saveNotesOnly();
    }
  }

  // ── Ruta: solo notas ────────────────────────────────────────────────────────

  async function saveNotesOnly() {
    if (!currentVersion) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("recipe_versions")
        .update({ preparation_notes: notes || null })
        .eq("id", currentVersion.id);

      if (error) throw error;
      toast("Notas guardadas", "success");
      router.refresh();
    } catch {
      toast("Error al guardar las notas", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Ruta: nueva versión ─────────────────────────────────────────────────────

  async function saveNewVersion() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let actorId: string | null = null;
      if (authUser) {
        const { data: userRecord } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", authUser.id)
          .single();
        actorId = userRecord?.id ?? null;
      }

      // 1. Desmarcar versión actual
      if (currentVersion) {
        await supabase
          .from("recipe_versions")
          .update({ is_current: false })
          .eq("id", currentVersion.id);
      }

      // 2. Crear nueva versión con costo calculado
      const { data: newVersion, error: vErr } = await supabase
        .from("recipe_versions")
        .insert({
          recipe_id:         recipeId,
          version:           nextVersion,
          portions_yield:    portionsYield,
          preparation_notes: notes || null,
          cost_per_portion:  Math.round(costPerPortion * 100) / 100,
          is_current:        true,
          created_by:        actorId,
        })
        .select()
        .single();

      if (vErr || !newVersion) throw vErr;

      // 3. Insertar ingredientes
      if (ingredients.length > 0) {
        await supabase.from("recipe_ingredients").insert(
          ingredients.map((ing) => ({
            recipe_version_id:  newVersion.id,
            inventory_item_id:  ing.inventoryItemId,
            quantity:           ing.quantity,
            unit:               ing.unit,
            substitute_item_id: ing.substituteItemId || null,
          }))
        );
      }

      toast(`Versión ${nextVersion} creada — costo/porción: $${costPerPortion.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`, "success");
      router.refresh();
    } catch (err) {
      console.error("Error creando versión:", err);
      toast("Error al guardar la nueva versión", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Dialog de confirmación para nueva versión */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Crear versión ${nextVersion}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Los cambios en ingredientes o rendimiento generan una nueva versión inmutable.
            La versión <strong>v{currentVersion?.version}</strong> quedará como historial y no se podrá modificar.
          </p>
          <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span>Rendimiento</span>
              <strong>{portionsYield} porciones</strong>
            </div>
            <div className="flex justify-between">
              <span>Costo estimado / porción</span>
              <strong className="text-primary">
                ${costPerPortion.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Ingredientes</span>
              <strong>{ingredients.length}</strong>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveNewVersion}>
              Crear versión {nextVersion}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Header de la sección */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ingredientes</h2>
        <div className="flex items-center gap-3">
          {!needsNewVersion && (
            <span className="text-xs text-text-secondary">Sin cambios en ingredientes</span>
          )}
          <Button size="sm" loading={saving} onClick={handleSaveClick}>
            <Save className="h-4 w-4" />
            {needsNewVersion ? `Guardar como v${nextVersion}` : "Guardar notas"}
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-4 py-3 font-medium">Insumo</th>
                <th className="w-28 px-4 py-3 font-medium">Cantidad</th>
                <th className="w-20 px-4 py-3 font-medium">Unidad</th>
                <th className="px-4 py-3 font-medium">Sustituto</th>
                <th className="w-36 px-4 py-3 text-right font-medium">Costo parcial</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <Select
                      options={itemOptions}
                      value={ing.inventoryItemId}
                      placeholder="Seleccionar insumo"
                      onChange={(e) => updateIngredient(idx, "inventoryItemId", e.target.value)}
                      className="!py-1"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ing.quantity || ""}
                      onChange={(e) =>
                        updateIngredient(idx, "quantity", parseFloat(e.target.value) || 0)
                      }
                      className="!py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-text-secondary">{ing.unit || "—"}</td>
                  <td className="px-4 py-2">
                    <Select
                      options={substitueOptions}
                      value={ing.substituteItemId ?? ""}
                      onChange={(e) =>
                        updateIngredient(idx, "substituteItemId", e.target.value || null)
                      }
                      className="!py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    ${(ing.quantity * ing.costPerUnit).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeIngredient(idx)}
                      className="rounded p-1 text-text-secondary transition-colors hover:bg-red-50 hover:text-error"
                      title="Quitar ingrediente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {ingredients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                    Sin ingredientes. Agregá el primero con el botón de abajo.
                  </td>
                </tr>
              )}

              {/* Fila de totales */}
              {ingredients.length > 0 && (
                <tr className="bg-surface-hover font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-sm">
                    Total costo · Costo por porción ({portionsYield} porciones)
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="block text-text-secondary text-xs">
                      ${totalCost.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-primary">
                      ${costPerPortion.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: agregar + rendimiento */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border p-3">
          <Button variant="ghost" size="sm" onClick={addIngredient}>
            <Plus className="h-4 w-4" />
            Agregar ingrediente
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-text-secondary">Rendimiento:</label>
            <Input
              type="number"
              min="1"
              value={portionsYield}
              onChange={(e) => setPortionsYield(parseInt(e.target.value) || 1)}
              className="!w-20 !py-1"
            />
            <span className="text-sm text-text-secondary">porciones</span>
          </div>
        </div>
      </Card>

      {/* Notas de preparación */}
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">Notas de preparación</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="Instrucciones paso a paso, tiempos, temperaturas..."
        />
        {!needsNewVersion && notes !== (currentVersion?.preparation_notes ?? "") && (
          <p className="mt-1 text-xs text-text-secondary">
            Solo cambiaron las notas — se guardarán sin crear nueva versión.
          </p>
        )}
      </div>
    </div>
  );
}
