"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { INV_CATEGORY_LABELS } from "@/lib/types/inventory";
import type { InventoryItem, InvCategory } from "@/lib/types/database";
import { Save } from "lucide-react";
import { updateItem } from "@/app/actions/inventory";

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
    setSaving(true);
    const result = await updateItem({
      id:          item.id,
      name:        form.name,
      category:    form.category,
      supplier:    form.supplier,
      minStock:    form.minStock,
      costPerUnit: form.costPerUnit,
    });
    setSaving(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast("Insumo actualizado", "success");
    router.refresh();
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
