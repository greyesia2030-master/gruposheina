"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startProductionTicket } from "@/lib/production/actions/start-ticket";
import { useToast } from "@/components/ui/toast";
import { PlayCircle } from "lucide-react";

interface Props {
  ticketId: string;
  isAdmin: boolean;
}

export function TicketStartButton({ ticketId, isAdmin: _isAdmin }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    startTransition(async () => {
      const result = await startProductionTicket(ticketId);
      if (result.ok) {
        const fallbacks = result.data.consumptions.filter((c) => c.fallback).length;
        const failed = result.data.consumptions.filter((c) => !c.ok).length;
        if (failed > 0) {
          toast(
            `Producción iniciada con ${failed} insumo(s) sin stock suficiente.`,
            "error"
          );
        } else if (fallbacks > 0) {
          toast(
            `Producción iniciada. ${fallbacks} insumo(s) descontados desde stock general (sin lote).`,
            "success"
          );
        } else {
          toast("Producción iniciada. Inventario FIFO consumido correctamente.", "success");
        }
        router.refresh();
      } else {
        toast(result.error || "Error al iniciar producción", "error");
        setConfirmed(false);
      }
    });
  };

  return (
    <div>
      {confirmed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
          Esto va a consumir el inventario según FIFO. ¿Confirmar inicio?
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#D4622B] hover:bg-[#b85224] disabled:opacity-50 text-white font-medium text-sm transition-colors"
      >
        <PlayCircle className="h-4 w-4" />
        {isPending
          ? "Iniciando…"
          : confirmed
          ? "Confirmar inicio de producción"
          : "Iniciar producción"}
      </button>
    </div>
  );
}
