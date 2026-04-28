"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientAdminCloseOrder } from "@/app/actions/portal-cliente";

export function CloseOrderButton({ orderId }: { orderId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClose() {
    setLoading(true);
    setError(null);
    const result = await clientAdminCloseOrder(orderId);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-xl border border-[#D4622B] px-4 py-2 text-sm font-medium text-[#D4622B] hover:bg-[#D4622B]/5 transition-colors"
      >
        Cerrar pedido
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
      <p className="text-xs text-stone-700">
        Al cerrar el pedido, Sheina recibirá una notificación para confirmar. ¿Continuar?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleClose}
          disabled={loading}
          className="rounded-xl bg-[#D4622B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b85224] disabled:opacity-60 transition-colors"
        >
          {loading ? "Cerrando…" : "Sí, cerrar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
