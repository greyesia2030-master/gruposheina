"use client";

import { useState, useEffect } from "react";
import { getOrderContext, type OrderContext } from "@/app/actions/order-context";

function formatCountdown(validUntil: string): string {
  const diff = new Date(validUntil).getTime() - Date.now();
  if (diff <= 0) return "Cerrado";
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function OrderContextHeader({ token }: { token: string }) {
  const [ctx, setCtx] = useState<OrderContext | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    getOrderContext(token).then((res) => {
      if (res.ok) {
        setCtx(res.data);
        setCountdown(formatCountdown(res.data.validUntil));
      }
    });
  }, [token]);

  useEffect(() => {
    if (!ctx) return;
    const id = setInterval(() => setCountdown(formatCountdown(ctx.validUntil)), 60000);
    return () => clearInterval(id);
  }, [ctx]);

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4622B] text-white text-xs font-bold select-none shrink-0">
          S
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
            {ctx ? ctx.organizationName : "Grupo Sheina"}
          </p>
          <p className="text-xs text-gray-500 leading-tight">
            {ctx
              ? `${ctx.weekLabel} · #${ctx.orderCode}`
              : "Formulario de pedido"}
          </p>
        </div>
        {ctx && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-400">Cierra en</p>
            <p className="text-xs font-semibold text-[#D4622B]">{countdown}</p>
          </div>
        )}
      </div>

      {ctx && ctx.totalSections > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">
              Sectores cerrados: {ctx.closedSections}/{ctx.totalSections}
            </span>
            {ctx.memberId && (
              <span className="text-xs text-gray-400">{ctx.memberId}</span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#D4622B] transition-all duration-500"
              style={{
                width: `${(ctx.closedSections / ctx.totalSections) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </header>
  );
}
