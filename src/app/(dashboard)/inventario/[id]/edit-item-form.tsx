"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { INV_CATEGORY_LABELS } from "@/lib/types/inventory";
import type { InventoryItem, InvCategory } from "@/lib/types/database";
import { Save } from "lucide-react";

const INV_CATEGORIES = Object.keys(INV_CATEGORY_LABELS) as [InvCategory, ...InvCategory[]];

const editItemSchema = z.object({
  name:        z.string().min(1, "El nombre es obligatorio").max(120),
  category:    z.enum(INV_CATEGORIES),
  supplier:    z.string().max(120).optional(),
  minStock:    z.coerce.number().min(0, "El mínimo no puede ser negativo"),
  costPerUnit: z.coerce.number().min(0, "El costo no puede ser negativo"),
});

const CATEGORY_OPTIONS = (
  Object.entries(INV_CATEGORY_LABELS) as [InvCategory, string][]
).map(([value, label]) => ({ value, label }));

interface EditItemFormProps {
  item: InventoryItem;
}

export function EditItemForm({ item }: EditItemFormProps) {
  const [form, setForm] = useState({
    name:        item.name,
    category:    item.category as InvCategory,
    supplier:    item.supplier ?? "",
    minStock:    String(item.min_stock),
    costPerUnit: String(item.cost_per_unit),
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isDirty =
    form.name        !== item.name                    ||
    form.category    !== item.category                ||
    form.supplier    !== (item.supplier ?? "")        ||
    form.minStock    !== String(item.min_stock)       ||
    form.costPerUnit !== String(item.cost_per_unit);

  async function handleSave() {
    const parsed = editItemSchema.safeParse({
      name:        form.name,
      category:    form.category,
      supplier:    form.supplier,
      minStock:    parseFloat(form.minStock),
      costPerUnit: parseFloat(form.costPerUnit),
    });

    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Datos inválidos", "error");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          name:          parsed.data.name.trim(),
          category:      parsed.data.category,
          supplier:      parsed.data.supplier?.trim() || null,
          min_stock:     parsed.data.minStock,
          cost_per_unit: parsed.data.costPerUnit,
        })
        .eq("id", item.id);

      if (error) throw error;

      toast("Insumo actualizado", "success");
      router.refresh();
    } catch {
      toast("Error al guardar cambios", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Datos del insumo</h2>
        {isDirty && (
          <Button size="sm" loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        )}
      </div>
      <Card>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
          <Select
            label="Categoría"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          />
          <Input
            label="Proveedor"
            value={form.supplier}
            onChange={(e) => update("supplier", e.target.value)}
            placeholder="Opcional"
          />
          <Input
            label={`Stock mínimo (${item.unit})`}
            type="number"
            step="0.01"
            min="0"
            value={form.minStock}
            onChange={(e) => update("minStock", e.target.value)}
          />
          <Input
            label="Costo por unidad ($)"
            type="number"
            step="0.01"
            min="0"
            value={form.costPerUnit}
            onChange={(e) => update("costPerUnit", e.target.value)}
          />
        </div>
        {isDirty && (
          <div className="border-t border-border px-4 py-3 text-right">
            <Button size="sm" loading={saving} onClick={handleSave}>
              <Save className="h-4 w-4" />
              Guardar cambios
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
