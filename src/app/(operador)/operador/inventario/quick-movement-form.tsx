"use client";

import { useState, useTransition } from "react";
import { registerMovement } from "@/app/actions/inventory";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";

interface ItemOption {
  id: string;
  name: string;
  unit: string;
}

interface QuickMovementFormProps {
  items: ItemOption[];
}

export function QuickMovementForm({ items }: QuickMovementFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [itemId, setItemId] = useState("");
  const [movementType, setMovementType] = useState<"purchase" | "adjustment_pos" | "adjustment_neg">("purchase");
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
            onChange={(e) => setMovementType(e.target.value as typeof movementType)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
          >
            <option value="purchase">Compra / ingreso</option>
            <option value="adjustment_pos">Ajuste positivo</option>
            <option value="adjustment_neg">Ajuste negativo</option>
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
