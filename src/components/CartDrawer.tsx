"use client";

import { useState, useEffect, useRef } from "react";
import { X, ShoppingCart } from "lucide-react";
import { getParticipantCart } from "@/app/actions/shared-form-public";
import { Loading } from "@/components/ui/loading";
import type { OrderLine } from "@/lib/types/database";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

interface CartDrawerProps {
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function CartDrawer({ accessToken, isOpen, onClose, onSubmit }: CartDrawerProps) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [fetching, setFetching] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCart = async () => {
    setFetching(true);
    const result = await getParticipantCart(accessToken);
    if (result.ok) {
      setLines(result.data.lines as unknown as OrderLine[]);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchCart();
    intervalRef.current = setInterval(fetchCart, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, accessToken]);

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  const byDay = lines.reduce<Record<number, OrderLine[]>>((acc, l) => {
    (acc[l.day_of_week] ??= []).push(l);
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-sm bg-white flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[#D4622B]" />
            <h2 className="font-semibold text-gray-900">Mi carrito</h2>
            {totalQty > 0 && (
              <span className="rounded-full bg-[#D4622B] text-white text-xs font-medium px-2 py-0.5">
                {totalQty}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {fetching && lines.length === 0 ? (
            <Loading className="py-8" />
          ) : lines.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Todavía no agregaste nada.</p>
              <p className="text-gray-400 text-xs mt-1">
                Volvé al menú y elegí tus viandas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byDay)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([dayNum, dayLines]) => (
                  <div key={dayNum}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {DAY_NAMES[Number(dayNum)]}
                    </p>
                    <div className="space-y-1">
                      {dayLines.map((l) => (
                        <div
                          key={l.id}
                          className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="text-sm text-gray-700 flex-1 mr-2 leading-tight">
                            {l.display_name}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 shrink-0">
                            {l.quantity}×
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm font-semibold text-gray-900 mb-3">
            <span>Total viandas</span>
            <span>{totalQty}</span>
          </div>
          <button
            onClick={() => { onClose(); onSubmit(); }}
            disabled={totalQty === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Cerrar mi aporte
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Seguir cargando
          </button>
        </div>
      </div>
    </div>
  );
}
