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
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types/menus";
import { Plus } from "lucide-react";
import type { MenuCategory } from "@/lib/types/database";

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

const CATEGORIES = CATEGORY_ORDER as [MenuCategory, ...MenuCategory[]];

const createRecipeSchema = z.object({
  name:     z.string().min(1, "El nombre es obligatorio").max(150),
  category: z.enum(CATEGORIES),
  portions: z.coerce.number().int().min(1, "El rendimiento debe ser al menos 1").max(10000),
});

export function CreateRecipeButton() {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState("");
  const [category, setCategory] = useState<MenuCategory>("principal");
  const [portions, setPortions] = useState(10);
  const [loading, setLoading]   = useState(false);
  const router   = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  async function handleCreate() {
    const parsed = createRecipeSchema.safeParse({ name, category, portions });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Datos inválidos", "error");
      return;
    }

    setLoading(true);
    try {
      const { data: recipe, error: rErr } = await supabase
        .from("recipes")
        .insert({ name: parsed.data.name.trim(), category: parsed.data.category, is_active: true })
        .select()
        .single();

      if (rErr || !recipe) throw rErr;

      const { error: vErr } = await supabase.from("recipe_versions").insert({
        recipe_id:         recipe.id,
        version:           1,
        portions_yield:    parsed.data.portions,
        cost_per_portion:  0,
        is_current:        true,
        preparation_notes: null,
      });

      if (vErr) throw vErr;

      toast("Receta creada", "success");
      setOpen(false);
      setName("");
      setCategory("principal");
      setPortions(10);
      router.push(`/recetas/${recipe.id}`);
    } catch {
      toast("Error al crear la receta", "error");
    } finally {
      setLoading(false);
    }
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
