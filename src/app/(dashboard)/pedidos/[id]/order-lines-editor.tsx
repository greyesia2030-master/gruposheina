"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
import { DAY_NAMES } from "@/lib/types/orders";
import { Save, AlertTriangle } from "lucide-react";

interface OrderLine {
  id: string;
  order_id: string;
  day_of_week: number;
  department: string;
  quantity: number;
  option_code: string;
  display_name: string;
}

interface DayOption {
  code: string;
  name: string;
  lineIds: Record<string, string>; // dept → line_id
  departments: Record<string, number>; // dept → qty
  total: number;
}

interface DayData {
  day: number;
  dayName: string;
  options: DayOption[];
  dayTotal: number;
}

interface OrderLinesEditorProps {
  orderId: string;
  lines: OrderLine[];
  departments: string[];
  isEditable: boolean;
  isPostCutoff: boolean;
}

export function OrderLinesEditor({
  orderId,
  lines,
  departments,
  isEditable,
  isPostCutoff,
}: OrderLinesEditorProps) {
  // Inicializar mapa de cantidades editables: lineId → qty
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.quantity]))
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createBrowserClient();

  function handleChange(lineId: string, value: number) {
    setQuantities((prev) => ({ ...prev, [lineId]: Math.max(0, value) }));
    setDirty(true);
  }

  async function handleSave() {
    if (isPostCutoff && !reason.trim()) {
      toast("Debés ingresar un motivo para modificaciones post-corte.", "warning");
      return;
    }
    setSaving(true);
    try {
      // Detectar líneas que cambiaron
      const changedLines = lines.filter((l) => quantities[l.id] !== l.quantity);
      if (changedLines.length === 0) {
        toast("No hay cambios para guardar.", "info");
        setSaving(false);
        setDirty(false);
        return;
      }

      // Actualizar cada línea que cambió
      for (const line of changedLines) {
        const { error } = await supabase
          .from("order_lines")
          .update({ quantity: quantities[line.id] })
          .eq("id", line.id);
        if (error) throw error;
      }

      // Recalcular total_units del pedido
      const newTotal = Object.values(quantities).reduce((a, b) => a + b, 0);
      await supabase.from("orders").update({ total_units: newTotal }).eq("id", orderId);

      // Crear evento de auditoría
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("order_events").insert({
        order_id: orderId,
        event_type: isPostCutoff ? "override" : "line_modified",
        actor_id: user?.id ?? null,
        actor_role: "admin",
        is_post_cutoff: isPostCutoff,
        payload: {
          changed_lines: changedLines.map((l) => ({
            id: l.id,
            option_code: l.option_code,
            department: l.department,
            old_qty: l.quantity,
            new_qty: quantities[l.id],
          })),
          ...(isPostCutoff ? { reason } : {}),
        },
      });

      toast("Cambios guardados.", "success");
      setDirty(false);
      setReason("");
      router.refresh();
    } catch (err) {
      console.error("Error guardando cambios:", err);
      toast("Error al guardar los cambios.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Agrupar líneas por día → opción para renderizar la tabla
  const linesByDay: DayData[] = [1, 2, 3, 4, 5]
    .map((day) => {
      const dayLines = lines.filter((l) => l.day_of_week === day);
      if (dayLines.length === 0) return null;

      const optionMap = new Map<string, DayOption>();
      for (const line of dayLines) {
        const existing = optionMap.get(line.option_code);
        if (existing) {
          existing.lineIds[line.department] = line.id;
          existing.departments[line.department] = quantities[line.id] ?? line.quantity;
          existing.total += quantities[line.id] ?? line.quantity;
        } else {
          optionMap.set(line.option_code, {
            code: line.option_code,
            name: line.display_name,
            lineIds: { [line.department]: line.id },
            departments: { [line.department]: quantities[line.id] ?? line.quantity },
            total: quantities[line.id] ?? line.quantity,
          });
        }
      }

      // Recalcular totals con quantities actuales
      for (const opt of optionMap.values()) {
        opt.total = departments.reduce(
          (sum, dept) => sum + (quantities[opt.lineIds[dept]] ?? 0),
          0
        );
      }

      const dayTotal = dayLines.reduce((sum, l) => sum + (quantities[l.id] ?? l.quantity), 0);
      return { day, dayName: DAY_NAMES[day] ?? `Día ${day}`, options: Array.from(optionMap.values()), dayTotal };
    })
    .filter((d): d is DayData => d !== null);

  return (
    <div>
      <div className="space-y-4">
        {linesByDay.map((dayData) => (
          <Card key={dayData.day}>
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold">{dayData.dayName}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-2 font-medium">Opción</th>
                    <th className="px-4 py-2 font-medium">Plato</th>
                    {departments.map((dept) => (
                      <th key={dept} className="px-3 py-2 text-center font-medium capitalize">
                        {dept}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dayData.options.map((opt) => (
                    <tr key={opt.code} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium text-primary">{opt.code}</td>
                      <td className="px-4 py-2">{opt.name}</td>
                      {departments.map((dept) => {
                        const lineId = opt.lineIds[dept];
                        const qty = quantities[lineId] ?? 0;
                        return (
                          <td key={dept} className="px-2 py-1.5 text-center">
                            {isEditable && lineId ? (
                              <input
                                type="number"
                                min={0}
                                value={qty}
                                onChange={(e) =>
                                  handleChange(lineId, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-16 rounded border border-border bg-surface px-2 py-1 text-center text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <span>{qty}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right font-semibold">{opt.total}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-hover font-semibold">
                    <td colSpan={2 + departments.length} className="px-4 py-2 text-right text-sm">
                      Total del día
                    </td>
                    <td className="px-4 py-2 text-right">{dayData.dayTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      {/* Sección de guardado */}
      {isEditable && dirty && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          {isPostCutoff && (
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Modificación post-corte — ingresá el motivo
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: El cliente llamó y pidió cambiar la opción A del lunes…"
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Hay cambios sin guardar</p>
            <Button size="sm" loading={saving} onClick={handleSave}>
              <Save className="mr-1.5 h-4 w-4" />
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
