"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { transitionOrderStatus } from "@/app/actions/orders";
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
  const action = QUICK_ACTIONS[status];
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

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

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Pedido actualizado: ${action!.label}`, "success");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleClick}>
      {action.label}
    </Button>
  );
}
