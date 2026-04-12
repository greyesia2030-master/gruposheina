"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types/menus";
import { Plus } from "lucide-react";
import type { MenuCategory } from "@/lib/types/database";
import { createRecipe } from "@/app/actions/recipes";

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

export function CreateRecipeButton() {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState("");
  const [category, setCategory] = useState<MenuCategory>("principal");
  const [portions, setPortions] = useState(10);
  const [loading, setLoading]   = useState(false);
  const router   = useRouter();
  const { toast } = useToast();

  async function handleCreate() {
    setLoading(true);
    const result = await createRecipe({ name, category, portions });
    setLoading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast("Receta creada", "success");
    setOpen(false);
    setName("");
    setCategory("principal");
    setPortions(10);
    router.push(`/recetas/${result.data.id}`);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nueva receta
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Nueva receta">
        <div className="space-y-4">
          <Input
            label="Nombre del plato"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Milanesa de carne con ensalada"
            autoFocus
          />
          <Select
            label="Categoría"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value as MenuCategory)}
          />
          <Input
            label="Rendimiento inicial (porciones)"
            type="number"
            min={1}
            value={portions}
            onChange={(e) => setPortions(parseInt(e.target.value) || 1)}
            helperText="Podés cambiar esto después en la ficha técnica"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={loading} disabled={!name.trim()} onClick={handleCreate}>
              Crear receta
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
