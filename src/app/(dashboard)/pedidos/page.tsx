export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge, Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { canViewSalePrice } from "@/lib/permissions";
import { QuickActionButton } from "./quick-action-button";
import { ClickableRow } from "./clickable-row";
import { NewOrderButton } from "./new-order-button";
import type { OrderStatus, PaymentStatus } from "@/lib/types/database";
import { MessageSquare, Globe, Phone } from "lucide-react";
import { formatART } from "@/lib/utils/timezone";

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

const PAYMENT_VARIANT: Record<PaymentStatus, "success" | "warning" | "danger" | "default"> = {
  paid:    "success",
  partial: "warning",
  overdue: "danger",
  pending: "default",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid:    "Pagado",
  partial: "Parcial",
  overdue: "Vencido",
  pending: "Pendiente",
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
  const [params, currentUser] = await Promise.all([
    searchParams,
    requireUser(),
  ]);
  const showFinancials = canViewSalePrice(currentUser.role);

  const supabase = await createSupabaseServer();

  let query = supabase
    .from("orders")
    .select(
      "id, order_code, week_label, status, source, total_units, total_amount, payment_status, created_at, organization:organizations(id, name)"
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status as OrderStatus);
  }
  if (params.semana) {
    query = query.ilike("week_label", `%${params.semana}%`);
  }

  const { data: orders } = await query;
  const activeStatus = params.status ?? "all";

  return (
    <div>
      <PageHeader title="Pedidos" action={<NewOrderButton />} />

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
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Semana</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Viandas</th>
                  {showFinancials && (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Monto</th>
                      <th className="px-4 py-3 font-medium">Pago</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-medium">Fuente</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  // Supabase many-to-one FK returns single object (not array)
                  const org = order.organization as unknown as { name: string } | null;
                  return (
                    <ClickableRow
                      key={order.id}
                      href={`/pedidos/${order.id}`}
                      className="border-b border-border last:border-0 hover:bg-surface-hover"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {(order as unknown as { order_code: string }).order_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {org?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{order.week_label}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status as OrderStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{order.total_units}</td>
                      {showFinancials && (
                        <>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {order.total_amount > 0
                              ? `$${order.total_amount.toLocaleString("es-AR")}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={PAYMENT_VARIANT[order.payment_status as PaymentStatus] ?? "default"}>
                              {PAYMENT_LABELS[order.payment_status as PaymentStatus] ?? order.payment_status}
                            </Badge>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          {SOURCE_ICONS[order.source]}
                          <span className="hidden sm:inline">{SOURCE_LABELS[order.source] ?? order.source}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatART(order.created_at, "dd/MM/yy")}
                      </td>
                      <td className="px-4 py-3">
                        <QuickActionButton
                          orderId={order.id}
                          status={order.status as OrderStatus}
                        />
                      </td>
                    </ClickableRow>
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
