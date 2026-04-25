export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import { ClickableRow } from "@/app/(dashboard)/pedidos/clickable-row";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ClipboardList,
  UtensilsCrossed,
  AlertTriangle,
  Package,
  TrendingDown,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();

  // Consultas en paralelo
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [ordersToday, inProduction, draftCount, pendingPayments] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("id, total_units")
      .eq("status", "in_production"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("payment_status", ["pending", "overdue"]),
  ]);

  const viandas =
    inProduction.data?.reduce((sum, o) => sum + (o.total_units ?? 0), 0) ?? 0;

  const stats = [
    {
      label: "Pedidos hoy",
      value: ordersToday.count ?? 0,
      icon: ClipboardList,
      color: "primary",
      href: "/pedidos",
    },
    {
      label: "Viandas a producir",
      value: viandas,
      icon: Package,
      color: "success",
      href: "/pedidos?status=in_production",
    },
    {
      label: "Pendientes de confirmar",
      value: draftCount.count ?? 0,
      icon: UtensilsCrossed,
      color: "info",
      href: "/pedidos?status=draft",
    },
    {
      label: "Pagos pendientes",
      value: pendingPayments.count ?? 0,
      icon: AlertTriangle,
      color: "warning",
      href: "/pedidos",
    },
  ];

  // Insumos con stock bajo
  const { data: allInventory } = await supabase
    .from("inventory_items")
    .select("id, name, current_stock, min_stock, unit, category")
    .eq("is_active", true);

  const lowStockItems = (allInventory ?? []).filter(
    (i) => i.current_stock < i.min_stock
  );

  // Últimos pedidos
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, week_label, status, total_units, source, created_at, organization:organizations(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex items-center gap-4 p-6">
                <div className={`rounded-lg bg-${stat.color}/10 p-3`}>
                  <stat.icon className={`h-6 w-6 text-${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Alertas de stock bajo */}
      {lowStockItems.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-error" />
              <h2 className="text-lg font-semibold">Stock bajo</h2>
              <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                {lowStockItems.length}
              </span>
            </div>
            <Link href="/inventario" className="text-sm text-primary hover:underline">
              Ver inventario
            </Link>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Insumo</th>
                    <th className="px-4 py-3 font-medium text-right">Stock actual</th>
                    <th className="px-4 py-3 font-medium text-right">Mínimo</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <Link href={`/inventario/${item.id}`} className="font-medium hover:text-primary">
                          {item.name}
                        </Link>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${item.current_stock === 0 ? "text-error" : "text-warning"}`}>
                        {item.current_stock}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">{item.min_stock}</td>
                      <td className="px-4 py-3 text-text-secondary">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Últimos pedidos */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos pedidos</h2>
          <Link href="/pedidos" className="text-sm text-primary hover:underline">
            Ver todos
          </Link>
        </div>

        {recentOrders && recentOrders.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Semana</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Viandas</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <ClickableRow key={order.id} href={`/pedidos/${order.id}`} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium">
                        {(order.organization as unknown as { name: string } | null)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">{order.week_label}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status as import("@/lib/types/database").OrderStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{order.total_units}</td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="p-8 text-center text-text-secondary">No hay pedidos aún</p>
          </Card>
        )}
      </div>
    </div>
  );
}
