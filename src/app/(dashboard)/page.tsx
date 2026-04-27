export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase/server";
import { DashboardKPIs } from "@/components/dashboard/kpis";
import { DashboardChartViandasPorDia } from "@/components/dashboard/chart-viandas-dia";
import { DashboardChartEstados } from "@/components/dashboard/chart-estados";
import { DashboardProximasEntregas } from "@/components/dashboard/proximas-entregas";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();

  const [ordersRes, linesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_code, status, total_units, week_label, created_at, organization_id, organization:organizations(name)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("order_lines")
      .select("quantity, menu_item:menu_items(day_of_week), order:orders(status)"),
  ]);

  const orders = ordersRes.data ?? [];
  const lines = linesRes.data ?? [];

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const INACTIVE = ["delivered", "cancelled"];
  const SKIP_TICKET = ["cancelled", "draft"];

  const activeOrders = orders.filter((o) => !INACTIVE.includes(o.status));
  const kpiPedidosActivos = activeOrders.length;
  const kpiViandasSemana = activeOrders.reduce((s, o) => s + (o.total_units ?? 0), 0);

  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const kpiClientesActivos = new Set(
    orders.filter((o) => o.created_at > cutoff).map((o) => o.organization_id)
  ).size;

  const forTicket = orders.filter((o) => !SKIP_TICKET.includes(o.status));
  const kpiTicketPromedio =
    forTicket.length > 0
      ? Math.round(forTicket.reduce((s, o) => s + (o.total_units ?? 0), 0) / forTicket.length)
      : 0;

  // ── Chart 1: viandas por día ───────────────────────────────────────────────
  const viandasPorDia: Record<number, number> = {};
  for (const l of lines) {
    const orderStatus = (l.order as unknown as { status: string } | null)?.status ?? "";
    if (INACTIVE.includes(orderStatus) || orderStatus === "draft") continue;
    const day = (l.menu_item as unknown as { day_of_week: number } | null)?.day_of_week;
    if (!day) continue;
    viandasPorDia[day] = (viandasPorDia[day] ?? 0) + (l.quantity ?? 0);
  }
  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const chartViandas = [1, 2, 3, 4, 5].map((d) => ({
    dia: DAY_NAMES[d - 1],
    viandas: viandasPorDia[d] ?? 0,
  }));

  // ── Chart 2: pedidos por estado ────────────────────────────────────────────
  const estadosCount: Record<string, number> = {};
  for (const o of orders) {
    estadosCount[o.status] = (estadosCount[o.status] ?? 0) + 1;
  }
  const chartEstados = Object.entries(estadosCount).map(([estado, cantidad]) => ({
    estado,
    cantidad,
  }));

  // ── Tabla próximas entregas ────────────────────────────────────────────────
  type OrderRow = (typeof orders)[number];
  const proximas: OrderRow[] = activeOrders.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Panel general</h1>
        <p className="text-sm text-stone-500 mt-1">Resumen operativo de Grupo Sheina</p>
      </div>

      <DashboardKPIs
        activos={kpiPedidosActivos}
        viandas={kpiViandasSemana}
        clientes={kpiClientesActivos}
        ticket={kpiTicketPromedio}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardChartViandasPorDia data={chartViandas} />
        <DashboardChartEstados data={chartEstados} />
      </div>

      <DashboardProximasEntregas orders={proximas} />
    </div>
  );
}
