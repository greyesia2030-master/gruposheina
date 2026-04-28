"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markProductionComplete } from "@/app/actions/orders";
import { useToast } from "@/components/ui/toast";
import { CheckCircle } from "lucide-react";

interface Props {
  orderId: string;
}

export function ProductionCompleteButton({ orderId }: Props) {
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
      const result = await markProductionComplete(orderId);
      if (result.ok) {
        toast(`Producción completada. ${result.data.consumed} movimientos registrados.`, "success");
        router.refresh();
      } else {
        toast(result.error || "Error al completar producción", "error");
        setConfirmed(false);
      }
    });
  };

  return (
    <div>
      {confirmed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-3">
          Esto registrará el consumo de insumos en el inventario. ¿Confirmar?
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
      >
        <CheckCircle className="h-4 w-4" />
        {isPending ? "Procesando…" : confirmed ? "Confirmar producción completa" : "Marcar producción completa"}
      </button>
    </div>
  );
}
