export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { QuickActionButton } from "./quick-action-button";
import type { OrderStatus } from "@/lib/types/database";
import { MessageSquare, Globe, Phone } from "lucide-react";

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  whatsapp_excel: <span title="WhatsApp Excel"><MessageSquare className="h-4 w-4 text-green-600" /></span>,
  whatsapp_bot:   <span title="WhatsApp Bot"><MessageSquare className="h-4 w-4 text-green-500" /></span>,
  web_form:       <span title="Web"><Globe className="h-4 w-4 text-blue-600" /></span>,
  phone:          <span title="Teléfono"><Phone className="h-4 w-4 text-gray-600" /></span>,
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp_excel: "WhatsApp",
  whatsapp_bot:   "WhatsApp Bot",
  web_form:       "Web",
  phone:          "Teléfono",
  subscription:   "Suscripción",
};

const TABS = [
  { key: "all",           label: "Todos" },
  { key: "draft",         label: "Borrador" },
  { key: "confirmed",     label: "Confirmados" },
  { key: "in_production", label: "En producción" },
  { key: "delivered",     label: "Entregados" },
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; semana?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServer();

  let query = supabase
    .from("orders")
    .select(
      "id, week_label, status, source, total_units, total_amount, payment_status, created_at, organization:organizations(id, name)"
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status as OrderStatus);
  }

  const { data: orders } = await query;

  const activeStatus = params.status ?? "all";

  return (
    <div>
      <PageHeader title="Pedidos" />

      {/* Tabs de estado */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/pedidos" : `/pedidos?status=${tab.key}`}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              activeStatus === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {orders && orders.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Semana</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Viandas</th>
                  <th className="px-4 py-3 font-medium">Fuente</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const org = (order.organization as unknown as { name: string }[] | null)?.[0] ?? null;
                  return (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <Link
                          href={`/pedidos/${order.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {org?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{order.week_label}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status as OrderStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{order.total_units}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          {SOURCE_ICONS[order.source]}
                          <span className="hidden sm:inline">{SOURCE_LABELS[order.source] ?? order.source}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(order.created_at).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <QuickActionButton
                          orderId={order.id}
                          status={order.status as OrderStatus}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="p-8 text-center text-text-secondary">No hay pedidos en esta categoría</p>
        </Card>
      )}
    </div>
  );
}
