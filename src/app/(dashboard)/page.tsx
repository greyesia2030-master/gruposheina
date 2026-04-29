export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { DashboardKPIs } from "@/components/dashboard/kpis";
import { DashboardChartViandasPorDia } from "@/components/dashboard/chart-viandas-dia";
import { DashboardChartEstados } from "@/components/dashboard/chart-estados";
import { DashboardProximasEntregas } from "@/components/dashboard/proximas-entregas";
import { WasteApprovalWidget } from "@/components/dashboard/waste-approval-widget";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const { fullName } = await requireUser();
  const firstName = (fullName ?? "").split(" ")[0] || null;

  const arNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const hour = arNow.getHours();
  const greeting = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = arNow.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const [ordersRes, linesRes, ticketsRes, wastePendingRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_code, status, total_units, week_label, created_at, organization_id, organization:organizations(name)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("order_lines")
      .select("quantity, menu_item:menu_items(day_of_week), order:orders(status)"),
    supabase
      .from("production_tickets")
      .select("id, status, quantity_target, recipe_version:recipe_versions(cost_per_portion)")
      .eq("production_date", today)
      .not("status", "eq", "cancelled"),
    supabase
      .from("inventory_movements")
      .select("id, item_id, quantity, reason, reference_id, item:inventory_items(name, unit)")
      .eq("movement_type", "waste_pending")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const orders = ordersRes.data ?? [];
  const lines = linesRes.data ?? [];
  const todayTickets = ticketsRes.data ?? [];
  const wastePending = wastePendingRes.data ?? [];

  // Production stats for today
  const prodPending = todayTickets.filter((t) => t.status === "pending").length;
  const prodInProgress = todayTickets.filter((t) => t.status === "in_progress").length;
  const prodReady = todayTickets.filter((t) => t.status === "ready").length;
  const prodBlocked = todayTickets.filter((t) => t.status === "blocked").length;
  const prodCostToday = todayTickets.reduce((sum, t) => {
    const rv = t.recipe_version as unknown as { cost_per_portion: number } | null;
    const cost = (rv?.cost_per_portion ?? 0) * ((t.quantity_target as number) || 0);
    return sum + cost;
  }, 0);

  // Waste approval items
  const wasteItems = wastePending.map((w) => {
    const item = w.item as unknown as { name: string; unit: string } | null;
    return {
      id: w.id as string,
      item_name: item?.name ?? "—",
      item_unit: item?.unit ?? "",
      quantity: (w.quantity as number) || 0,
      reason: w.reason as string | null,
      ticket_id: w.reference_id as string | null,
    };
  });

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
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500 mb-2">
            Panel general
          </p>
          <h1 className="font-heading text-4xl font-light text-stone-900 leading-tight">
            {greeting},{" "}
            <em className="italic font-medium text-[#D4622B]">
              {firstName ?? "bienvenido"}
            </em>
            .
          </h1>
          <p className="text-sm text-stone-500 mt-2 max-w-xl">
            Resumen operativo de Grupo Sheina — pedidos activos, viandas comprometidas y métricas semanales.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-medium capitalize mt-1">
          {dateLabel}
        </div>
      </div>

      <DashboardKPIs
        activos={kpiPedidosActivos}
        viandas={kpiViandasSemana}
        clientes={kpiClientesActivos}
        ticket={kpiTicketPromedio}
      />

      {/* Producción hoy + mermas */}
      {todayTickets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
                  Producción hoy
                </h3>
                <Link
                  href="/operador/produccion"
                  className="text-xs text-[#D4622B] hover:underline"
                >
                  Ver cola →
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{prodPending}</p>
                  <p className="text-xs text-stone-400">Pendientes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{prodInProgress}</p>
                  <p className="text-xs text-stone-400">En prod.</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{prodReady}</p>
                  <p className="text-xs text-stone-400">Listos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{prodBlocked}</p>
                  <p className="text-xs text-stone-400">Bloqueados</p>
                </div>
              </div>
              {prodCostToday > 0 && (
                <p className="text-xs text-stone-500 border-t border-stone-100 pt-3">
                  Costo estimado del día: ${prodCostToday.toLocaleString("es-AR")}
                </p>
              )}
            </div>
          </Card>

          {wasteItems.length > 0 && (
            <Card>
              <div className="p-5">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-4">
                  Mermas pendientes ({wasteItems.length})
                </h3>
                <WasteApprovalWidget items={wasteItems} />
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardChartViandasPorDia data={chartViandas} />
        <DashboardChartEstados data={chartEstados} />
      </div>

      <DashboardProximasEntregas orders={proximas} />
    </div>
  );
}
