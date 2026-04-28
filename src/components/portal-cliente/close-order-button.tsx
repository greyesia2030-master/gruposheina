"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientAdminCloseOrder } from "@/app/actions/portal-cliente";
import { useToast } from "@/components/ui/toast";

export function CloseOrderButton({ orderId, sectionNames }: { orderId: string; sectionNames?: string[] }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

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
    toast("Pedido enviado a Sheina para aprobación", "success");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-xl border border-[#D4622B] px-4 py-2 text-sm font-medium text-[#D4622B] hover:bg-[#D4622B]/5 transition-colors"
      >
        Cerrar y enviar a Sheina
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
      <p className="text-sm font-semibold text-stone-800">¿Cerrar el pedido y enviarlo a Sheina?</p>
      <ul className="text-xs text-stone-600 space-y-0.5 list-disc list-inside">
        {sectionNames && sectionNames.length > 0 ? (
          <li>Todas las secciones ({sectionNames.join(", ")}) se cierran.</li>
        ) : (
          <li>Todas las secciones del pedido se cierran.</li>
        )}
        <li>Tu equipo no podrá cargar más viandas.</li>
        <li>El pedido pasa a &quot;Esperando aprobación&quot;.</li>
        <li>Sheina recibe el pedido para revisión.</li>
      </ul>
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleClose}
          disabled={loading}
          className="rounded-xl bg-[#D4622B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b85224] disabled:opacity-60 transition-colors"
        >
          {loading ? "Enviando…" : "Sí, cerrar y enviar"}
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
