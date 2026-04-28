"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { duplicateMenu } from "@/app/actions/menus";
import { Copy } from "lucide-react";
import { addDays, getISOWeek, getDay } from "date-fns";

interface DuplicateMenuButtonProps {
  sourceMenuId: string;
  sourceWeekLabel: string;
}

export function DuplicateMenuButton({ sourceMenuId, sourceWeekLabel }: DuplicateMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Preview de la fecha fin
  const weekEndPreview = weekStart
    ? addDays(new Date(weekStart + "T00:00:00"), 4)
        .toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
    : null;
  const weekNumberPreview = weekStart
    ? getISOWeek(new Date(weekStart + "T00:00:00"))
    : null;

  async function handleDuplicate() {
    if (!weekStart) return;
    setLoading(true);
    const result = await duplicateMenu({ sourceMenuId, weekStart });
    setLoading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Menú duplicado correctamente", "success");
    setOpen(false);
    router.push(`/menus/${result.data.id}`);
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-primary"
        title="Duplicar menú"
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicar
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Duplicar menú">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Copiará todas las opciones del menú <strong>{sourceWeekLabel}</strong> a una nueva semana.
          </p>

          <Input
            label="Fecha inicio de la nueva semana (lunes)"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            helperText={
              weekStart
                ? `Viernes: ${weekEndPreview} — Semana ISO ${weekNumberPreview}`
                : "Seleccioná el lunes de la semana destino"
            }
          />
          {weekStart && getDay(new Date(weekStart + "T00:00:00")) !== 1 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              La fecha debe ser un lunes. Seleccioná el lunes de la semana que querés crear.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={loading}
              disabled={!weekStart || loading || (!!weekStart && getDay(new Date(weekStart + "T00:00:00")) !== 1)}
              onClick={handleDuplicate}
            >
              Duplicar menú
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
