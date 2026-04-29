import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ChefHat, Package, AlertTriangle } from "lucide-react";
import { formatART } from "@/lib/utils/timezone";

export default async function OperadorDashboardPage() {
  await requireUser();
  const supabase = await createSupabaseServer();

  const today = new Date().toISOString().slice(0, 10);
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [ticketsRes, todayRes, lowStockRes] = await Promise.all([
    supabase
      .from("production_tickets")
      .select("id, status, production_date")
      .gte("production_date", today)
      .lte("production_date", in14Days)
      .in("status", ["pending", "in_progress", "paused", "blocked"]),
    supabase
      .from("production_tickets")
      .select("id, status")
      .eq("production_date", today)
      .in("status", ["pending", "in_progress", "paused", "blocked"]),
    supabase
      .from("inventory_items")
      .select("id, name, unit, current_stock, min_stock")
      .eq("is_active", true)
      .filter("current_stock", "lte", "min_stock")
      .order("name")
      .limit(10),
  ]);

  const activeTickets = ticketsRes.data ?? [];
  const todayTickets = todayRes.data ?? [];
  const lowStock = lowStockRes.data ?? [];

  const pendingCount = activeTickets.filter((t) => t.status === "pending").length;
  const inProgressCount = activeTickets.filter((t) => t.status === "in_progress").length;
  const pausedCount = activeTickets.filter((t) => t.status === "paused").length;
  const readyCount = todayTickets.filter((t) => t.status === "ready").length;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-heading font-light text-stone-900 mb-1">Dashboard operativo</h1>
      <p className="text-sm text-stone-400 mb-8">{formatART(new Date().toISOString(), "EEEE dd MMMM yyyy")}</p>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Tickets activos */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="h-4 w-4 text-[#D4622B]" />
            <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
              Tickets activos ({activeTickets.length})
            </h2>
          </div>
          {activeTickets.length === 0 ? (
            <Card>
              <p className="p-4 text-center text-stone-400 text-sm">
                Sin tickets activos en los próximos 14 días.
              </p>
            </Card>
          ) : (
            <Card>
              <div className="p-4 space-y-2">
                {pendingCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Pendientes</span>
                    <span className="font-bold text-amber-600">{pendingCount}</span>
                  </div>
                )}
                {inProgressCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">En producción</span>
                    <span className="font-bold text-blue-600">{inProgressCount}</span>
                  </div>
                )}
                {pausedCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Pausados</span>
                    <span className="font-bold text-stone-500">{pausedCount}</span>
                  </div>
                )}
                {todayTickets.length > 0 && (
                  <p className="text-xs text-stone-400 pt-1 border-t border-stone-100">
                    {todayTickets.length} para hoy
                  </p>
                )}
              </div>
            </Card>
          )}
          <Link href="/operador/produccion" className="text-xs text-[#D4622B] hover:underline mt-2 inline-block">
            Ir a producción →
          </Link>
        </div>

        {/* Alertas de stock */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
              Stock bajo ({lowStock.length})
            </h2>
          </div>
          {lowStock.length === 0 ? (
            <Card>
              <p className="p-4 text-center text-stone-400 text-sm">Sin alertas de stock.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {lowStock.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-amber-400 border-stone-200">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{item.name}</p>
                      <p className="text-xs text-stone-400">
                        Stock: {item.current_stock} {item.unit} · Mín: {item.min_stock} {item.unit}
                      </p>
                    </div>
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          )}
          <Link href="/operador/inventario" className="text-xs text-[#D4622B] hover:underline mt-2 inline-block">
            Ver inventario →
          </Link>
        </div>
      </div>
    </div>
  );
}
