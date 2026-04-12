"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { INV_CATEGORY_LABELS } from "@/lib/types/inventory";
import type { InvCategory } from "@/lib/types/database";
import { Plus } from "lucide-react";
import { createItem } from "@/app/actions/inventory";

const CATEGORY_OPTIONS = (Object.entries(INV_CATEGORY_LABELS) as [InvCategory, string][]).map(
  ([value, label]) => ({ value, label })
);

export function CreateItemButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:         "",
    category:     "otros" as InvCategory,
    unit:         "kg",
    currentStock: "0",
    minStock:     "0",
    costPerUnit:  "0",
    supplier:     "",
  });
  const router = useRouter();
  const { toast } = useToast();

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate() {
    setLoading(true);
    const result = await createItem({
      name:         form.name,
      category:     form.category,
      unit:         form.unit,
      currentStock: form.currentStock,
      minStock:     form.minStock,
      costPerUnit:  form.costPerUnit,
      supplier:     form.supplier,
    });
    setLoading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast("Insumo creado", "success");
    setOpen(false);
    setForm({ name: "", category: "otros", unit: "kg", currentStock: "0", minStock: "0", costPerUnit: "0", supplier: "" });
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo insumo
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo insumo">
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={(e) => updateField("name", e.target.value)} autoFocus />
          <Select label="Categoría" options={CATEGORY_OPTIONS} value={form.category} onChange={(e) => updateField("category", e.target.value)} />
          <Input label="Unidad (kg, lt, un)" value={form.unit} onChange={(e) => updateField("unit", e.target.value)} placeholder="kg" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock inicial" type="number" step="0.01" min="0" value={form.currentStock} onChange={(e) => updateField("currentStock", e.target.value)} />
            <Input label="Stock mínimo" type="number" step="0.01" min="0" value={form.minStock} onChange={(e) => updateField("minStock", e.target.value)} />
          </div>
          <Input label="Costo por unidad ($)" type="number" step="0.01" min="0" value={form.costPerUnit} onChange={(e) => updateField("costPerUnit", e.target.value)} />
          <Input label="Proveedor" value={form.supplier} onChange={(e) => updateField("supplier", e.target.value)} placeholder="Opcional" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={loading}>Crear insumo</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
