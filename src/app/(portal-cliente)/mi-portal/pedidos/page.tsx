import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { formatART } from "@/lib/utils/timezone";
import type { OrderStatus } from "@/lib/types/database";
import { NewOrderModal } from "./new-order-modal";

export default async function MiPortalPedidosPage() {
  const currentUser = await requireUser();
  if (!currentUser.organizationId) return null;

  const supabase = await createSupabaseServer();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, total_units, created_at")
    .eq("organization_id", currentUser.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const canCreate = ["client_admin", "superadmin", "admin"].includes(currentUser.role);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-light text-stone-900">Mis pedidos</h1>
        {canCreate && <NewOrderModal />}
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <p className="p-8 text-center text-stone-400 text-sm">Sin pedidos registrados.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link key={order.id} href={`/mi-portal/pedidos/${order.id}`}>
              <Card className="hover:border-[#D4622B]/40 transition-colors cursor-pointer">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-stone-900 text-sm">{order.week_label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {formatART(order.created_at, "dd MMM yyyy")} · {order.total_units} viandas
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-mono text-stone-400">{order.order_code}</p>
                    <OrderStatusBadge status={order.status as OrderStatus} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
