"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { transitionOrderStatus, returnOrderToClient } from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/types/database";
import type { StockCheckResult } from "@/app/actions/orders";

interface ActionConfig {
  label: string;
  newStatus: OrderStatus;
  variant: "primary" | "secondary" | "danger";
  /** Si true, solo se muestra si el pedido está dentro de corte (o el operador es admin) */
  requiresCutoff?: boolean;
}

const ACTIONS: Partial<Record<OrderStatus, ActionConfig[]>> = {
  draft: [
    { label: "Confirmar pedido",    newStatus: "confirmed",     variant: "primary" },
    { label: "Cancelar",            newStatus: "cancelled",     variant: "danger" },
  ],
  awaiting_confirmation: [
    { label: "Confirmar pedido",    newStatus: "confirmed",     variant: "primary" },
    { label: "Cancelar",            newStatus: "cancelled",     variant: "danger" },
  ],
  partially_filled: [
    { label: "Forzar confirmación", newStatus: "confirmed",     variant: "secondary" },
    { label: "Cancelar",            newStatus: "cancelled",     variant: "danger" },
  ],
  confirmed: [
    { label: "A producción",        newStatus: "in_production", variant: "primary" },
    { label: "Cancelar",            newStatus: "cancelled",     variant: "danger", requiresCutoff: true },
  ],
  in_production: [
    { label: "Marcar entregado",    newStatus: "delivered",     variant: "primary" },
  ],
};

interface OrderActionsProps {
  orderId: string;
  status: OrderStatus;
  isWithinCutoff: boolean;
  stockCheck?: StockCheckResult;
}

export function OrderActions({ orderId, status, isWithinCutoff, stockCheck }: OrderActionsProps) {
  const [loading, setLoading]               = useState<OrderStatus | null>(null);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [overrideReason, setOverrideReason]   = useState("");
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason]         = useState("");
  const [returningOrder, setReturningOrder]     = useState(false);
  const router  = useRouter();
  const { toast } = useToast();

  const allActions = ACTIONS[status] ?? [];
  const actions = allActions.filter(
    (a) => !a.requiresCutoff || isWithinCutoff
  );

  if (actions.length === 0) return null;

  async function executeTransition(newStatus: OrderStatus, reason?: string) {
    setLoading(newStatus);
    const result = await transitionOrderStatus({ orderId, newStatus, reason });
    setLoading(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Pedido actualizado`, "success");
    router.refresh();
  }

  async function handleAction(action: ActionConfig) {
    // If moving to production and stock is short, gate behind override dialog
    if (action.newStatus === "in_production" && stockCheck && !stockCheck.canProduce) {
      setShowStockDialog(true);
      return;
    }
    await executeTransition(action.newStatus);
  }

  async function handleStockOverride() {
    if (!overrideReason.trim()) return;
    setShowStockDialog(false);
    await executeTransition("in_production", overrideReason.trim());
    setOverrideReason("");
  }

  async function handleReturnOrder() {
    if (!returnReason.trim()) return;
    setReturningOrder(true);
    const result = await returnOrderToClient({ orderId, reason: returnReason.trim() });
    setReturningOrder(false);
    setShowReturnDialog(false);
    setReturnReason("");
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Pedido devuelto al cliente", "success");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.newStatus}
            variant={action.variant}
            size="sm"
            loading={loading === action.newStatus}
            disabled={loading !== null}
            onClick={() => handleAction(action)}
          >
            {action.label}
          </Button>
        ))}
        {status === "awaiting_confirmation" && (
          <Button
            variant="secondary"
            size="sm"
            disabled={loading !== null || returningOrder}
            onClick={() => setShowReturnDialog(true)}
          >
            Devolver al cliente
          </Button>
        )}
      </div>

      {/* Return to client dialog */}
      <Dialog
        open={showReturnDialog}
        onClose={() => { setShowReturnDialog(false); setReturnReason(""); }}
        title="Devolver pedido al cliente"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            El pedido volverá a estado borrador y el cliente recibirá el motivo para corregirlo.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Motivo <span className="text-error">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              placeholder="Ej: Faltan viandas del sector Administración…"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowReturnDialog(false); setReturnReason(""); }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!returnReason.trim() || returningOrder}
              loading={returningOrder}
              onClick={handleReturnOrder}
            >
              Devolver
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Stock shortage override dialog */}
      <Dialog
        open={showStockDialog}
        onClose={() => { setShowStockDialog(false); setOverrideReason(""); }}
        title="Stock insuficiente"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Hay {stockCheck?.shortages.length ?? 0} insumo
            {(stockCheck?.shortages.length ?? 0) !== 1 ? "s" : ""} con stock insuficiente.
            Podés continuar con producción ingresando un motivo.
          </p>

          {stockCheck && stockCheck.shortages.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-amber-700">
                    <th className="pb-1 pr-3 font-medium">Insumo</th>
                    <th className="pb-1 pr-3 text-right font-medium">Necesario</th>
                    <th className="pb-1 text-right font-medium">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {stockCheck.shortages.map((s) => (
                    <tr key={s.inventoryItemId} className="border-t border-amber-100">
                      <td className="py-1 pr-3 font-medium text-amber-900">{s.name}</td>
                      <td className="py-1 pr-3 text-right text-amber-800">
                        {s.needed.toFixed(2)} {s.unit}
                      </td>
                      <td className="py-1 text-right font-semibold text-red-700">
                        -{s.deficit.toFixed(2)} {s.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Motivo para continuar <span className="text-error">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              placeholder="Ej: proveedor entregó tarde, se usará stock de reserva..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowStockDialog(false); setOverrideReason(""); }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!overrideReason.trim() || loading !== null}
              loading={loading === "in_production"}
              onClick={handleStockOverride}
            >
              Confirmar producción
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
