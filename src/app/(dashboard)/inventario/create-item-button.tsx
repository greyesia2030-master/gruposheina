"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { INV_CATEGORY_LABELS } from "@/lib/types/inventory";
import type { InvCategory } from "@/lib/types/database";
import { Plus } from "lucide-react";

const CATEGORY_OPTIONS = (Object.entries(INV_CATEGORY_LABELS) as [InvCategory, string][]).map(
  ([value, label]) => ({ value, label })
);

const INV_CATEGORIES = Object.keys(INV_CATEGORY_LABELS) as [InvCategory, ...InvCategory[]];

const createItemSchema = z.object({
  name:         z.string().min(1, "El nombre es obligatorio").max(120),
  category:     z.enum(INV_CATEGORIES),
  unit:         z.string().min(1, "La unidad es obligatoria").max(20),
  currentStock: z.coerce.number().min(0, "El stock no puede ser negativo"),
  minStock:     z.coerce.number().min(0, "El mínimo no puede ser negativo"),
  costPerUnit:  z.coerce.number().min(0, "El costo no puede ser negativo"),
  supplier:     z.string().max(120).optional(),
});

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
  const supabase = createBrowserClient();

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate() {
    const parsed = createItemSchema.safeParse({
      ...form,
      currentStock: parseFloat(form.currentStock),
      minStock:     parseFloat(form.minStock),
      costPerUnit:  parseFloat(form.costPerUnit),
    });

    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Datos inválidos", "error");
      return;
    }

    const data = parsed.data;
    setLoading(true);
    try {
      const { data: newItem, error } = await supabase
        .from("inventory_items")
        .insert({
          name:          data.name,
          category:      data.category,
          unit:          data.unit,
          current_stock: data.currentStock,
          min_stock:     data.minStock,
          cost_per_unit: data.costPerUnit,
          supplier:      data.supplier?.trim() || null,
          is_active:     true,
        })
        .select()
        .single();

      if (error) throw error;

      // Movimiento inicial si hay stock
      if (data.currentStock > 0 && newItem) {
        await supabase.from("inventory_movements").insert({
          item_id:       newItem.id,
          movement_type: "adjustment_pos",
          quantity:      data.currentStock,
          unit_cost:     data.costPerUnit,
          reason:        "Stock inicial",
          stock_after:   data.currentStock,
        });
      }

      toast("Insumo creado", "success");
      setOpen(false);
      setForm({ name: "", category: "otros", unit: "kg", currentStock: "0", minStock: "0", costPerUnit: "0", supplier: "" });
      router.refresh();
    } catch {
      toast("Error al crear insumo", "error");
    } finally {
      setLoading(false);
    }
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
