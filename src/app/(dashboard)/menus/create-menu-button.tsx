"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { getISOWeek, addDays } from "date-fns";
import { Plus } from "lucide-react";

const createMenuSchema = z.object({
  weekStart: z.string().min(1, "Seleccioná una fecha de inicio").regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Formato de fecha inválido"
  ),
});

export function CreateMenuButton() {
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  async function handleCreate() {
    const parsed = createMenuSchema.safeParse({ weekStart });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Datos inválidos", "error");
      return;
    }

    setLoading(true);
    try {
      const start = new Date(weekStart);
      const end = addDays(start, 4);
      const weekNumber = getISOWeek(start);

      const { data, error } = await supabase
        .from("weekly_menus")
        .insert({
          week_start: weekStart,
          week_end: end.toISOString().split("T")[0],
          week_number: weekNumber,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      toast("Menú creado", "success");
      setOpen(false);
      router.push(`/menus/${data.id}`);
    } catch {
      toast("Error al crear menú", "error");
    } finally {
      setLoading(false);
    }
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
