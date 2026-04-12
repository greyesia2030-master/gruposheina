import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DAY_NAMES } from "@/lib/types/orders";
import { isWithinCutoff } from "@/lib/orders/cutoff";
import { OrderActions } from "./order-actions";
import { OrderTimeline } from "./order-timeline";
import { OrderLinesEditor } from "./order-lines-editor";
import {
  Building2,
  Calendar,
  Hash,
  Clock,
  MessageSquare,
  Globe,
  Phone,
} from "lucide-react";
import type { OrderStatus } from "@/lib/types/database";

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  whatsapp_excel: <MessageSquare className="h-4 w-4 text-green-600" />,
  whatsapp_bot:   <MessageSquare className="h-4 w-4 text-green-500" />,
  web_form:       <Globe className="h-4 w-4 text-blue-600" />,
  phone:          <Phone className="h-4 w-4 text-gray-600" />,
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp_excel: "WhatsApp Excel",
  whatsapp_bot:   "WhatsApp Bot",
  web_form:       "Web",
  phone:          "Teléfono",
  subscription:   "Suscripción",
};

export default async function PedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  // Cargar pedido con organización y menú para corte
  const { data: order } = await supabase
    .from("orders")
    .select("*, organization:organizations(*), menu:weekly_menus(id, week_start, week_end)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  // Cargar líneas y eventos en paralelo
  const [linesResult, eventsResult] = await Promise.all([
    supabase
      .from("order_lines")
      .select("*")
      .eq("order_id", id)
      .order("day_of_week")
      .order("option_code"),
    supabase
      .from("order_events")
      .select("*, actor:users(full_name)")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const lines = linesResult.data ?? [];
  const events = eventsResult.data ?? [];

  const org = (order.organization as unknown as {
    name: string;
    cutoff_time: string;
    cutoff_days_before: number;
  }[] | null)?.[0] ?? null;

  const menu = (order.menu as unknown as { id: string; week_start: string; week_end: string }[] | null)?.[0] ?? null;

  // Calcular ventana de corte
  const withinCutoff =
    org && menu
      ? isWithinCutoff(order, menu, org)
      : true;

  // Un pedido es editable si está en draft, o en confirmed y aún dentro del corte
  const editableStatuses: OrderStatus[] = ["draft", "confirmed"];
  const isEditable = editableStatuses.includes(order.status as OrderStatus);
  // Post-corte: confirmado pero fuera de ventana
  const isPostCutoff = order.status === "confirmed" && !withinCutoff;

  // Detectar departamentos usados (orden consistente)
  const departments = [...new Set(lines.map((l) => l.department))].sort();

  return (
    <div>
      <PageHeader
        title={`Pedido — ${order.week_label}`}
        breadcrumbs={[
          { label: "Pedidos", href: "/pedidos" },
          { label: order.week_label },
        ]}
        action={
          <OrderActions
            orderId={order.id}
            status={order.status as OrderStatus}
            isWithinCutoff={withinCutoff}
          />
        }
      />

      {/* Tarjetas de info */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3 p-4">
            <Building2 className="h-5 w-5 shrink-0 text-text-secondary" />
            <div className="min-w-0">
              <p className="text-xs text-text-secondary">Cliente</p>
              <p className="truncate font-medium">{org?.name ?? "—"}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <Calendar className="h-5 w-5 shrink-0 text-text-secondary" />
            <div>
              <p className="text-xs text-text-secondary">Estado</p>
              <OrderStatusBadge status={order.status as OrderStatus} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <Hash className="h-5 w-5 shrink-0 text-text-secondary" />
            <div>
              <p className="text-xs text-text-secondary">Total viandas</p>
              <p className="text-xl font-bold">{order.total_units}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 shrink-0 text-text-secondary" />
            <div>
              <p className="text-xs text-text-secondary">Fuente / Creado</p>
              <div className="flex items-center gap-1.5">
                {SOURCE_ICONS[order.source]}
                <span className="text-sm">{SOURCE_LABELS[order.source] ?? order.source}</span>
              </div>
              <p className="text-xs text-text-secondary">
                {new Date(order.created_at).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detalle de líneas (editable o solo lectura) */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Detalle del pedido</h2>
          {isPostCutoff && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              ⚠ Post-corte — se requiere motivo para guardar
            </span>
          )}
        </div>

        {lines.length > 0 ? (
          <OrderLinesEditor
            orderId={order.id}
            lines={lines}
            departments={departments}
            isEditable={isEditable}
            isPostCutoff={isPostCutoff}
          />
        ) : (
          <Card>
            <p className="p-8 text-center text-text-secondary">Sin líneas de pedido</p>
          </Card>
        )}
      </div>

      {/* Timeline de eventos */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial de cambios</h2>
        <OrderTimeline events={events} />
      </div>
    </div>
  );
}
