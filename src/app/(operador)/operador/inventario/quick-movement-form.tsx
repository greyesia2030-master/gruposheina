"use client";

import { useState, useTransition } from "react";
import { registerMovement } from "@/app/actions/inventory";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import type { UserRole } from "@/lib/types/database";

interface ItemOption {
  id: string;
  name: string;
  unit: string;
}

type AllowedMovement = "purchase" | "adjustment_pos" | "adjustment_neg" | "production_consumption" | "waste" | "return";

const ALL_MOVEMENT_OPTIONS: { value: AllowedMovement; label: string }[] = [
  { value: "purchase",              label: "Compra / ingreso" },
  { value: "adjustment_pos",        label: "Ajuste positivo" },
  { value: "adjustment_neg",        label: "Ajuste negativo" },
  { value: "production_consumption",label: "Consumo" },
  { value: "waste",                 label: "Merma" },
  { value: "return",                label: "Devolución" },
];

const MOVEMENT_OPTIONS_BY_ROLE: Partial<Record<UserRole, AllowedMovement[]>> = {
  kitchen:    ["production_consumption", "waste"],
  operator:   ["production_consumption", "waste", "purchase", "adjustment_pos", "adjustment_neg", "return"],
  warehouse:  ["purchase", "adjustment_pos", "adjustment_neg", "production_consumption", "waste", "return"],
  admin:      ["purchase", "adjustment_pos", "adjustment_neg", "production_consumption", "waste", "return"],
  superadmin: ["purchase", "adjustment_pos", "adjustment_neg", "production_consumption", "waste", "return"],
};

interface QuickMovementFormProps {
  items: ItemOption[];
  userRole: UserRole;
}

export function QuickMovementForm({ items, userRole }: QuickMovementFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [itemId, setItemId] = useState("");

  const allowedValues = MOVEMENT_OPTIONS_BY_ROLE[userRole] ?? ["production_consumption", "waste"];
  const visibleOptions = ALL_MOVEMENT_OPTIONS.filter((o) => allowedValues.includes(o.value));
  const defaultType = visibleOptions[0]?.value ?? "production_consumption";

  const [movementType, setMovementType] = useState<AllowedMovement>(defaultType);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const selectedItem = items.find((i) => i.id === itemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !quantity) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast("Ingresá una cantidad válida", "error");
      return;
    }
    startTransition(async () => {
      const result = await registerMovement({
        itemId,
        movementType,
        quantity: qty,
        reason: reason.trim() || undefined,
      });
      if (result.ok) {
        toast("Movimiento registrado correctamente", "success");
        setQuantity("");
        setReason("");
      } else {
        toast(result.error || "Error al registrar", "error");
      }
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Insumo</label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
            required
          >
            <option value="">Seleccioná un insumo…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de movimiento</label>
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as AllowedMovement)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
          >
            {visibleOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Cantidad{selectedItem ? ` (${selectedItem.unit})` : ""}
          </label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Motivo{movementType.startsWith("adjustment") ? " *" : " (opcional)"}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Compra proveedor, inventario físico…"
            maxLength={300}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !itemId || !quantity}
          className="w-full bg-[#D4622B] hover:bg-[#b85224] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {isPending ? "Registrando…" : "Registrar movimiento"}
        </button>
      </form>
    </Card>
  );
}
