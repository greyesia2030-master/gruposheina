"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { saveParticipantOverride, getMenuItemsForOrder } from "@/app/actions/admin-overrides";
import type { MenuItem } from "@/lib/types/database";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

type Line = {
  id: string;
  quantity: number;
  day_of_week: number;
  display_name: string;
  menu_item_id: string;
};

type Change = {
  lineId?: string;
  menuItemId?: string;
  dayOfWeek: number;
  quantity: number;
  action: "update" | "create" | "delete";
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  orderId: string;
  participant: {
    id: string;
    display_name: string;
    order_lines: Line[];
  };
}

export function EditParticipantModal({
  open,
  onClose,
  onSaved,
  orderId,
  participant,
}: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [newLines, setNewLines] = useState<
    Array<{ menuItemId: string; dayOfWeek: number; quantity: number; key: string }>
  >([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, number> = {};
    for (const l of participant.order_lines) {
      initial[l.id] = l.quantity;
    }
    setQuantities(initial);
    setNewLines([]);
    setError("");
  }, [open, participant]);

  // Load menu items once when modal opens
  useEffect(() => {
    if (!open || menuItems.length > 0) return;
    setLoadingItems(true);
    getMenuItemsForOrder(orderId).then((res) => {
      if (res.ok) setMenuItems(res.data);
      setLoadingItems(false);
    });
  }, [open, orderId, menuItems.length]);

  const addNewLine = () => {
    setNewLines((prev) => [
      ...prev,
      { menuItemId: "", dayOfWeek: 1, quantity: 1, key: crypto.randomUUID() },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const changes: Change[] = [];

    // Existing lines: check for modifications or deletions
    for (const line of participant.order_lines) {
      const newQty = quantities[line.id] ?? line.quantity;
      if (newQty === 0) {
        changes.push({ lineId: line.id, dayOfWeek: line.day_of_week, quantity: 0, action: "delete" });
      } else if (newQty !== line.quantity) {
        changes.push({ lineId: line.id, dayOfWeek: line.day_of_week, quantity: newQty, action: "update" });
      }
    }

    // New lines
    for (const nl of newLines) {
      if (nl.menuItemId && nl.quantity > 0) {
        changes.push({
          menuItemId: nl.menuItemId,
          dayOfWeek: nl.dayOfWeek,
          quantity: nl.quantity,
          action: "create",
        });
      }
    }

    if (changes.length === 0) {
      onClose();
      setSaving(false);
      return;
    }

    const result = await saveParticipantOverride({ orderId, participantId: participant.id, changes });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Editar aporte — ${participant.display_name}`}
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {participant.order_lines.length === 0 && newLines.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Sin viandas cargadas</p>
        )}

        {/* Existing lines */}
        {participant.order_lines.map((line) => (
          <div key={line.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{line.display_name}</p>
              <p className="text-xs text-gray-500">{DAY_NAMES[line.day_of_week]}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() =>
                  setQuantities((q) => ({ ...q, [line.id]: Math.max(0, (q[line.id] ?? line.quantity) - 1) }))
                }
                className="w-7 h-7 rounded border text-sm font-bold hover:bg-gray-100"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-medium">
                {quantities[line.id] ?? line.quantity}
              </span>
              <button
                onClick={() =>
                  setQuantities((q) => ({ ...q, [line.id]: (q[line.id] ?? line.quantity) + 1 }))
                }
                className="w-7 h-7 rounded border text-sm font-bold hover:bg-gray-100"
              >
                +
              </button>
            </div>
            {(quantities[line.id] ?? line.quantity) === 0 && (
              <span className="text-xs text-red-500">Se eliminará</span>
            )}
          </div>
        ))}

        {/* New lines */}
        {newLines.map((nl, idx) => (
          <div key={nl.key} className="flex items-center gap-2 border-t pt-3">
            <select
              value={nl.menuItemId}
              onChange={(e) =>
                setNewLines((prev) =>
                  prev.map((n, i) => (i === idx ? { ...n, menuItemId: e.target.value } : n))
                )
              }
              className="flex-1 text-sm border rounded-lg px-2 py-1.5"
            >
              <option value="">Seleccionar item…</option>
              {Object.entries(
                menuItems.reduce<Record<number, MenuItem[]>>((acc, item) => {
                  const day = (item as unknown as { day_of_week: number }).day_of_week;
                  (acc[day] ??= []).push(item);
                  return acc;
                }, {})
              ).map(([day, items]) => (
                <optgroup key={day} label={DAY_NAMES[Number(day)] ?? `Día ${day}`}>
                  {items.map((item) => (
                    <option
                      key={(item as unknown as { id: string }).id}
                      value={(item as unknown as { id: string }).id}
                    >
                      {(item as unknown as { display_name: string }).display_name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={nl.quantity}
              onChange={(e) =>
                setNewLines((prev) =>
                  prev.map((n, i) =>
                    i === idx ? { ...n, quantity: Math.max(1, Number(e.target.value)) } : n
                  )
                )
              }
              className="w-14 text-sm border rounded-lg px-2 py-1.5 text-center"
            />
            <button
              onClick={() => setNewLines((prev) => prev.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          </div>
        ))}

        {loadingItems && <p className="text-xs text-gray-400">Cargando items…</p>}

        <button
          onClick={addNewLine}
          className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
        >
          + Agregar item
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <Button onClick={handleSave} loading={saving} disabled={saving}>
          Guardar cambios
        </Button>
      </div>
    </Dialog>
  );
}
