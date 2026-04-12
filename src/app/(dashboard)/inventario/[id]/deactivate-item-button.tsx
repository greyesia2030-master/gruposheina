"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { PowerOff, AlertTriangle } from "lucide-react";

interface ActiveRecipe {
  name: string;
  recipeId: string;
}

interface DeactivateItemButtonProps {
  itemId: string;
  itemName: string;
  activeRecipes: ActiveRecipe[];
}

export function DeactivateItemButton({
  itemId,
  itemName,
  activeRecipes,
}: DeactivateItemButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  async function handleDeactivate() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: false })
        .eq("id", itemId);

      if (error) throw error;

      toast(`"${itemName}" desactivado`, "success");
      router.push("/inventario");
    } catch {
      toast("Error al desactivar el insumo", "error");
      setLoading(false);
    }
  }

  const hasRecipes = activeRecipes.length > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-error hover:bg-red-50 hover:text-error"
      >
        <PowerOff className="h-4 w-4" />
        Desactivar insumo
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Desactivar insumo"
      >
        <div className="space-y-4">
          {hasRecipes ? (
            <>
              <div className="flex items-start gap-3 rounded-lg bg-warning/10 px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-text">
                    Este insumo está en uso por {activeRecipes.length}{" "}
                    {activeRecipes.length === 1 ? "receta activa" : "recetas activas"}.
                  </p>
                  <p className="mt-1 text-text-secondary">
                    Al desactivarlo dejará de estar disponible para nuevas versiones de recetas.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <p className="border-b border-border px-3 py-2 text-xs font-medium text-text-secondary">
                  Recetas afectadas
                </p>
                <ul className="divide-y divide-border">
                  {activeRecipes.map((r) => (
                    <li key={r.recipeId} className="px-3 py-2 text-sm">
                      {r.name}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm text-text-secondary">
                ¿Querés desactivarlo de todas formas?
              </p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              ¿Estás seguro de que querés desactivar{" "}
              <strong className="text-text">{itemName}</strong>? No se podrá
              usar en nuevas recetas ni movimientos de inventario.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={loading}
              onClick={handleDeactivate}
              className="bg-error text-white hover:bg-error/90"
            >
              Desactivar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
