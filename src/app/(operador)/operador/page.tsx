import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import Link from "next/link";
import { ChefHat, Package, AlertTriangle } from "lucide-react";
import { formatART } from "@/lib/utils/timezone";
import type { OrderStatus } from "@/lib/types/database";

export default async function OperadorDashboardPage() {
  await requireUser();
  const supabase = await createSupabaseServer();

  const today = new Date().toISOString().slice(0, 10);

  const [productionRes, lowStockRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, week_label, order_code, status, total_units, organization:organizations(name)")
      .in("status", ["confirmed", "in_production"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("inventory_items")
      .select("id, name, unit, current_stock, min_stock")
      .eq("is_active", true)
      .filter("current_stock", "lte", "min_stock")
      .order("name")
      .limit(10),
  ]);

  const orders = productionRes.data ?? [];
  const lowStock = lowStockRes.data ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-heading font-light text-stone-900 mb-1">Dashboard operativo</h1>
      <p className="text-sm text-stone-400 mb-8">{formatART(new Date().toISOString(), "EEEE dd MMMM yyyy")}</p>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Pedidos en producción */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="h-4 w-4 text-[#D4622B]" />
            <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
              Pedidos activos ({orders.length})
            </h2>
          </div>
          {orders.length === 0 ? (
            <Card>
              <p className="p-4 text-center text-stone-400 text-sm">Sin pedidos activos.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => {
                const org = order.organization as unknown as { name: string } | null;
                return (
                  <Link key={order.id} href={`/operador/produccion/${order.id}`}>
                    <Card className="hover:border-[#D4622B]/40 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-stone-900">{org?.name ?? "—"}</p>
                          <p className="text-xs text-stone-400">{order.week_label} · {order.total_units} viandas</p>
                        </div>
                        <OrderStatusBadge status={order.status as OrderStatus} />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
          <Link href="/operador/produccion" className="text-xs text-[#D4622B] hover:underline mt-2 inline-block">
            Ver todos →
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
                <Card key={item.id}>
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
