"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getParticipantCart, submitCart } from "@/app/actions/shared-form-public";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import type { OrderLine } from "@/lib/types/database";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

export default function ResumenPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { toast } = useToast();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyClosed, setAlreadyClosed] = useState(false);

  useEffect(() => {
    const at = localStorage.getItem(`access_token_${token}`);
    if (!at) {
      router.replace(`/pedido/${token}`);
      return;
    }
    setAccessToken(at);

    getParticipantCart(at).then((result) => {
      if (result.ok) {
        setLines(result.data.lines as unknown as OrderLine[]);
        if (result.data.submitted_at) setAlreadyClosed(true);
      } else {
        toast("No se pudo cargar el resumen", "error");
      }
      setLoading(false);
    });
  }, [token, router, toast]);

  const handleConfirm = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    const result = await submitCart(accessToken);
    if (!result.ok) {
      toast(result.error || "Error al cerrar aporte", "error");
      setSubmitting(false);
      return;
    }
    localStorage.removeItem(`access_token_${token}`);
    router.push(`/pedido/${token}/gracias?pid=${result.data.participantId}`);
  };

  if (loading) return <PageLoading />;

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  const byDay = lines.reduce<Record<number, OrderLine[]>>((acc, l) => {
    (acc[l.day_of_week] ??= []).push(l);
    return acc;
  }, {});

  if (alreadyClosed) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Ya cerraste tu aporte</h1>
        <p className="text-gray-500 text-sm">Tu selección ya fue enviada correctamente.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Resumen de tu aporte</h1>
      <p className="text-sm text-gray-500 mb-6">
        Revisá tu selección antes de confirmar. Una vez cerrado no podés modificarla.
      </p>

      {/* Lines grouped by day */}
      {lines.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          No agregaste ninguna vianda. Volvé al menú para seleccionar.
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border divide-y mb-6">
          {Object.entries(byDay)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([dayNum, dayLines]) => (
              <div key={dayNum} className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {DAY_NAMES[Number(dayNum)]}
                </p>
                {dayLines.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-700">{l.display_name}</span>
                    <span className="font-medium text-gray-900">{l.quantity}×</span>
                  </div>
                ))}
              </div>
            ))}
          <div className="px-4 py-3 flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>{totalQty} viandas</span>
          </div>
        </div>
      )}

      <Button
        size="lg"
        className="w-full mb-3 bg-green-600 hover:bg-green-700"
        onClick={handleConfirm}
        disabled={submitting || lines.length === 0}
        loading={submitting}
      >
        Confirmar y cerrar aporte
      </Button>

      <button
        onClick={() => router.back()}
        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        Volver al menú
      </button>
    </div>
  );
}
