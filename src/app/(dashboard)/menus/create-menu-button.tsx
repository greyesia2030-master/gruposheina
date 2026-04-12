"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createMenu } from "@/app/actions/menus";
import { getISOWeek, addDays } from "date-fns";
import { Plus } from "lucide-react";

export function CreateMenuButton() {
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleCreate() {
    setLoading(true);
    const result = await createMenu({ weekStart });
    setLoading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast("Menú creado", "success");
    setOpen(false);
    router.push(`/menus/${result.data.id}`);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo menú
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo menú semanal">
        <div className="space-y-4">
          <Input
            label="Fecha inicio (lunes)"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
          {weekStart && (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-text-secondary">
              Viernes: <strong>
                {addDays(new Date(weekStart + "T00:00:00"), 4)
                  .toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
              </strong>
              {" — "}Semana ISO <strong>{getISOWeek(new Date(weekStart + "T00:00:00"))}</strong>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!weekStart || loading}>
              {loading ? "Creando..." : "Crear menú"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
