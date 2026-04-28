"use client";

import { useState, useTransition } from "react";
import { recordPartialWaste } from "@/lib/production/actions/record-partial-waste";
import { useToast } from "@/components/ui/toast";

interface ItemOption {
  id: string;
  name: string;
  unit: string;
}

interface Props {
  ticketId: string;
  items: ItemOption[];
}

export function PartialWasteForm({ ticketId, items }: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const selectedItem = items.find((i) => i.id === itemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!itemId || isNaN(qty) || qty <= 0) {
      toast("Ingresá insumo y cantidad válida", "error");
      return;
    }
    startTransition(async () => {
      const result = await recordPartialWaste(ticketId, {
        itemId,
        quantity: qty,
        reason: reason.trim(),
      });
      if (result.ok) {
        toast("Merma registrada", "success");
        setQuantity("");
        setReason("");
      } else {
        toast(result.error || "Error al registrar merma", "error");
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="text-xs text-stone-400 italic">
        Sin ingredientes disponibles para registrar merma.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[140px]">
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-24">
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={selectedItem?.unit ?? "cant."}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
          required
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo"
          maxLength={200}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
        />
      </div>
      <button
        type="submit"
        disabled={isPending || !quantity}
        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {isPending ? "…" : "Registrar"}
      </button>
    </form>
  );
}
