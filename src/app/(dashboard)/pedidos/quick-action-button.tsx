"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { transitionOrderStatus } from "@/app/actions/orders";
import { dispatchOrder } from "@/lib/orders/actions/dispatch-order";
import { confirmDelivery } from "@/lib/orders/actions/confirm-delivery";
import type { OrderStatus } from "@/lib/types/database";

const QUICK_ACTIONS: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  draft:     { label: "Confirmar",     next: "confirmed" },
  confirmed: { label: "A producción",  next: "in_production" },
};

export function QuickActionButton({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Logistics: dispatch
  if (status === "ready_for_delivery") {
    async function handleDispatch(e: React.MouseEvent) {
      e.stopPropagation();
      e.preventDefault();
      setLoading(true);
      const result = await dispatchOrder(orderId);
      setLoading(false);
      if (!result.ok) { toast(result.error, "error"); return; }
      toast("Pedido despachado", "success");
      router.refresh();
    }
    return (
      <Button variant="outline" size="sm" loading={loading} onClick={handleDispatch}>
        Marcar despachado
      </Button>
    );
  }

  // Logistics: confirm delivery
  if (status === "out_for_delivery") {
    async function handleDeliver(e: React.MouseEvent) {
      e.stopPropagation();
      e.preventDefault();
      setLoading(true);
      const result = await confirmDelivery(orderId);
      setLoading(false);
      if (!result.ok) { toast(result.error, "error"); return; }
      toast("Entrega confirmada", "success");
      router.refresh();
    }
    return (
      <Button variant="outline" size="sm" loading={loading} onClick={handleDeliver}>
        Confirmar entrega
      </Button>
    );
  }

  // Generic state machine transitions
  const action = QUICK_ACTIONS[status];
  if (!action) return null;

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    const result = await transitionOrderStatus({
      orderId,
      newStatus: action!.next,
    });
    setLoading(false);
    if (!result.ok) { toast(result.error, "error"); return; }
    toast(`Pedido actualizado: ${action!.label}`, "success");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleClick}>
      {action.label}
    </Button>
  );
}
