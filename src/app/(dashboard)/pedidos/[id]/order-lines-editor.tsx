"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateOrderLines } from "@/app/actions/orders";
import { DAY_NAMES } from "@/lib/types/orders";
import { Save, AlertTriangle } from "lucide-react";
import { AdminEditableQuantity } from "./admin-editable-quantity";

interface OrderLine {
  id: string;
  order_id: string;
  day_of_week: number;
  department: string;
  quantity: number;
  option_code: string;
  display_name: string;
  is_admin_override?: boolean;
}

interface DayOption {
  code: string;
  name: string;
  lineIds: Record<string, string>; // dept → line_id
  departments: Record<string, number>; // dept → qty
  total: number;
  overrideQty: number; // sum of is_admin_override lines for this option
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
  isAdmin?: boolean;
  hasOverrideByKey?: Record<string, boolean>;
  isLocked?: boolean;
}

export function OrderLinesEditor({
  orderId,
  lines,
  departments,
  isEditable,
  isPostCutoff,
  isAdmin = false,
  hasOverrideByKey = {},
  isLocked = false,
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

  function handleChange(lineId: string, value: number) {
    setQuantities((prev) => ({ ...prev, [lineId]: Math.max(0, value) }));
    setDirty(true);
  }

  async function handleSave() {
    if (isPostCutoff && !reason.trim()) {
      toast("Debés ingresar un motivo para modificaciones post-corte.", "warning");
      return;
    }

    const changedLines = lines.filter((l) => quantities[l.id] !== l.quantity);
    if (changedLines.length === 0) {
      toast("No hay cambios para guardar.", "info");
      setDirty(false);
      return;
    }

    setSaving(true);
    const result = await updateOrderLines({
      orderId,
      changes: changedLines.map((l) => ({
        lineId: l.id,
        quantity: quantities[l.id],
      })),
      reason: reason || undefined,
    });
    setSaving(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Cambios guardados.", "success");
    setDirty(false);
    setReason("");
    router.refresh();
  }

  // Agrupar líneas por día → opción para renderizar la tabla
  const linesByDay: DayData[] = [1, 2, 3, 4, 5]
    .map((day) => {
      const dayLines = lines.filter((l) => l.day_of_week === day);
      if (dayLines.length === 0) return null;

      const optionMap = new Map<string, DayOption>();
      for (const line of dayLines) {
        const qty = quantities[line.id] ?? line.quantity;
        const existing = optionMap.get(line.option_code);

        if (line.is_admin_override) {
          // Override lines accumulate in overrideQty, not in dept columns
          if (existing) {
            existing.overrideQty += qty;
          } else {
            optionMap.set(line.option_code, {
              code: line.option_code,
              name: line.display_name,
              lineIds: {},
              departments: {},
              total: 0,
              overrideQty: qty,
            });
          }
          continue;
        }

        if (existing) {
          existing.lineIds[line.department] = line.id;
          existing.departments[line.department] = qty;
        } else {
          optionMap.set(line.option_code, {
            code: line.option_code,
            name: line.display_name,
            lineIds: { [line.department]: line.id },
            departments: { [line.department]: qty },
            total: 0,
            overrideQty: 0,
          });
        }
      }

      // Recalcular totals: dept columns + override lines
      for (const opt of optionMap.values()) {
        opt.total =
          departments.reduce((sum, dept) => sum + (quantities[opt.lineIds[dept]] ?? 0), 0) +
          opt.overrideQty;
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
                      <td className="px-4 py-2 text-right">
                        {isAdmin ? (
                          <AdminEditableQuantity
                            orderId={orderId}
                            dayOfWeek={dayData.day}
                            optionCode={opt.code}
                            currentTotal={opt.total}
                            hasOverride={hasOverrideByKey[`${dayData.day}_${opt.code}`] ?? false}
                            disabled={isLocked}
                          />
                        ) : (
                          <span className={`font-semibold ${hasOverrideByKey[`${dayData.day}_${opt.code}`] ? "text-amber-700" : ""}`}>
                            {opt.total}
                          </span>
                        )}
                      </td>
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
