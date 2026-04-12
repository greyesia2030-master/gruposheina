"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
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
  const supabase = createBrowserClient();

  if (!action) return null;

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // no navegar al detalle
    e.preventDefault();
    setLoading(true);
    try {
      const updateData: Record<string, unknown> = { status: action!.next };
      if (action!.next === "confirmed") updateData.confirmed_at = new Date().toISOString();

      const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
      if (error) throw error;

      toast(`Pedido actualizado: ${action!.label}`, "success");
      router.refresh();
    } catch {
      toast("Error al actualizar el pedido", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleClick}>
      {action.label}
    </Button>
  );
}
