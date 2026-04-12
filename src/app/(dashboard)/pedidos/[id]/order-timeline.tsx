"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Check,
  XCircle,
  Truck,
  Edit,
  AlertTriangle,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  event_type: string;
  actor_role: string;
  payload: Record<string, unknown> | null;
  is_post_cutoff: boolean;
  created_at: string;
  actor: { full_name: string } | null;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  created: { label: "Pedido creado", icon: <Plus className="h-4 w-4" />, color: "text-blue-500" },
  confirmed: { label: "Pedido confirmado", icon: <Check className="h-4 w-4" />, color: "text-green-500" },
  cancelled: { label: "Pedido cancelado", icon: <XCircle className="h-4 w-4" />, color: "text-red-500" },
  delivered: { label: "Pedido entregado", icon: <Truck className="h-4 w-4" />, color: "text-green-600" },
  line_modified: { label: "Línea modificada", icon: <Edit className="h-4 w-4" />, color: "text-amber-500" },
  line_added: { label: "Línea agregada", icon: <Plus className="h-4 w-4" />, color: "text-blue-500" },
  line_removed: { label: "Línea eliminada", icon: <XCircle className="h-4 w-4" />, color: "text-red-500" },
  override: { label: "Modificación post-corte", icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-600" },
};

export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <p className="p-6 text-center text-text-secondary">Sin eventos registrados</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-4">
        <div className="space-y-4">
          {events.map((event, i) => {
            const config = EVENT_CONFIG[event.event_type] ?? {
              label: event.event_type,
              icon: <Edit className="h-4 w-4" />,
              color: "text-gray-500",
            };

            return (
              <div key={event.id} className="flex gap-3">
                {/* Línea vertical */}
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover ${config.color}`}>
                    {config.icon}
                  </div>
                  {i < events.length - 1 && (
                    <div className="mt-1 w-px flex-1 bg-border" />
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{config.label}</p>
                    {event.is_post_cutoff && (
                      <Badge variant="warning">post-corte</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {event.actor?.full_name ?? event.actor_role} — {" "}
                    {new Date(event.created_at).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {event.payload && "reason" in event.payload && event.payload.reason ? (
                    <p className="mt-1 text-xs text-text-secondary italic">
                      Motivo: {String(event.payload.reason)}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
