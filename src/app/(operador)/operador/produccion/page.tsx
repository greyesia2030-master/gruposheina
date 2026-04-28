import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import Link from "next/link";
import type { OrderStatus } from "@/lib/types/database";

export default async function OperadorProduccionPage() {
  await requireUser();
  const supabase = await createSupabaseServer();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, total_units, organization:organizations(name)")
    .in("status", ["confirmed", "in_production"])
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-6">Pedidos en producción</h1>

      {!orders || orders.length === 0 ? (
        <Card>
          <p className="p-8 text-center text-stone-400 text-sm">Sin pedidos en producción.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const org = order.organization as unknown as { name: string } | null;
            return (
              <Link key={order.id} href={`/operador/produccion/${order.id}`}>
                <Card className="hover:border-[#D4622B]/40 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between px-4 py-4">
                    <div>
                      <p className="font-medium text-stone-900">{org?.name ?? "—"}</p>
                      <p className="text-sm text-stone-500">{order.week_label}</p>
                      <p className="text-xs text-stone-400 font-mono">{order.order_code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <OrderStatusBadge status={order.status as OrderStatus} />
                      <p className="text-sm text-stone-500">{order.total_units} viandas</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
