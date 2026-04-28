"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeProductionTicket } from "@/lib/production/actions/complete-ticket";
import { useToast } from "@/components/ui/toast";
import { CheckCircle } from "lucide-react";

interface Props {
  ticketId: string;
  quantityTarget: number;
}

export function TicketCompleteModal({ ticketId, quantityTarget }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [quantityProduced, setQuantityProduced] = useState(quantityTarget);
  const [quantityWasted, setQuantityWasted] = useState(0);
  const [wasteReason, setWasteReason] = useState("");

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await completeProductionTicket(ticketId, {
        quantityProduced,
        quantityWasted,
        wasteReason: wasteReason.trim() || undefined,
      });
      if (result.ok) {
        toast("Producción completada.", "success");
        setOpen(false);
        router.refresh();
      } else {
        toast(result.error || "Error al completar producción", "error");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
      >
        <CheckCircle className="h-4 w-4" />
        Marcar como listo (Completar)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-stone-900 mb-1">
              Completar producción
            </h3>
            <p className="text-sm text-stone-500 mb-5">
              Objetivo: {quantityTarget} viandas
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Cantidad producida real
                </label>
                <input
                  type="number"
                  min="0"
                  max={quantityTarget + 50}
                  value={quantityProduced}
                  onChange={(e) => setQuantityProduced(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Merma final (viandas)
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantityWasted}
                  onChange={(e) => setQuantityWasted(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
                />
              </div>
              {quantityWasted > 0 && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Motivo de merma (opcional)
                  </label>
                  <input
                    type="text"
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    placeholder="Ej: Se quemó una bandeja…"
                    maxLength={200}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending || quantityProduced < 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {isPending ? "Confirmando…" : "Confirmar producción"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
