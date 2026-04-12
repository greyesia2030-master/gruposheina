"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";
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

const EVENT_TYPE: Partial<Record<OrderStatus, string>> = {
  confirmed:     "confirmed",
  cancelled:     "cancelled",
  delivered:     "delivered",
  in_production: "confirmed",
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
  const supabase = createBrowserClient();

  const allActions = ACTIONS[status] ?? [];
  // Filtrar acciones que requieren corte cuando ya pasó
  const actions = allActions.filter(
    (a) => !a.requiresCutoff || isWithinCutoff
  );

  if (actions.length === 0) return null;

  async function handleAction(action: ActionConfig) {
    setLoading(action.newStatus);
    try {
      // Obtener el registro de users (no el auth.user) para el actor_id correcto
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let actorId: string | null = null;
      if (authUser) {
        const { data: userRecord } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", authUser.id)
          .single();
        actorId = userRecord?.id ?? null;
      }

      const updateData: Record<string, unknown> = { status: action.newStatus };
      if (action.newStatus === "confirmed") {
        updateData.confirmed_at = new Date().toISOString();
        if (actorId) updateData.confirmed_by = actorId;
      }

      const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
      if (error) throw error;

      // Auditoría
      await supabase.from("order_events").insert({
        order_id:      orderId,
        event_type:    EVENT_TYPE[action.newStatus] ?? "confirmed",
        actor_id:      actorId,
        actor_role:    "admin",
        is_post_cutoff: !isWithinCutoff,
        payload:       { newStatus: action.newStatus },
      });

      toast(`Pedido actualizado: ${action.label}`, "success");
      router.refresh();
    } catch (err) {
      console.error("Error actualizando pedido:", err);
      toast("Error al actualizar el pedido", "error");
    } finally {
      setLoading(null);
    }
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
