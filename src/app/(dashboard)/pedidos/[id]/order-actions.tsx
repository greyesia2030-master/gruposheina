"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { transitionOrderStatus } from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/types/database";

interface ActionConfig {
  label: string;
  newStatus: OrderStatus;
  variant: "primary" | "secondary" | "danger";
  /** Si true, solo se muestra si el pedido está dentro de corte (o el operador es admin) */
  requiresCutoff?: boolean;
}

const ACTIONS: Partial<Record<OrderStatus, ActionConfig[]>> = {
  draft: [
    { label: "Confirmar pedido", newStatus: "confirmed",     variant: "primary" },
    { label: "Cancelar",         newStatus: "cancelled",     variant: "danger" },
  ],
  confirmed: [
    { label: "A producción",     newStatus: "in_production", variant: "primary" },
    { label: "Cancelar",         newStatus: "cancelled",     variant: "danger", requiresCutoff: true },
  ],
  in_production: [
    { label: "Marcar entregado", newStatus: "delivered",     variant: "primary" },
  ],
};

interface OrderActionsProps {
  orderId: string;
  status: OrderStatus;
  isWithinCutoff: boolean;
}

export function OrderActions({ orderId, status, isWithinCutoff }: OrderActionsProps) {
  const [loading, setLoading] = useState<OrderStatus | null>(null);
  const router  = useRouter();
  const { toast } = useToast();

  const allActions = ACTIONS[status] ?? [];
  // Filtrar acciones que requieren corte cuando ya pasó
  const actions = allActions.filter(
    (a) => !a.requiresCutoff || isWithinCutoff
  );

  if (actions.length === 0) return null;

  async function handleAction(action: ActionConfig) {
    setLoading(action.newStatus);
    const result = await transitionOrderStatus({
      orderId,
      newStatus: action.newStatus,
    });
    setLoading(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Pedido actualizado: ${action.label}`, "success");
    router.refresh();
  }

  return (
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
    </div>
  );
}
