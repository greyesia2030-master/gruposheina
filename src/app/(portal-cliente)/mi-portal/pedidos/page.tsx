import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { formatART } from "@/lib/utils/timezone";
import type { OrderStatus } from "@/lib/types/database";
import { NewOrderModal } from "./new-order-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ShoppingBag } from "lucide-react";

function cutoffShortLabel(cutoffAt: string | null): string | null {
  if (!cutoffAt) return null;
  const diff = new Date(cutoffAt).getTime() - Date.now();
  if (diff <= 0) return "Cerrado";
  const totalMin = Math.floor(diff / 60000);
  if (totalMin < 60) return `Cierra en ${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  if (hours < 24) return `Cierra en ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Cierra en ${days}d`;
}

export default async function MiPortalPedidosPage() {
  const currentUser = await requireUser();
  if (!currentUser.organizationId) return null;

  const supabase = await createSupabaseServer();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, total_units, created_at, custom_cutoff_at")
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
        <EmptyState
          icon={ShoppingBag}
          title="Sin pedidos registrados"
          description="Todavía no tenés pedidos. ¿Querés crear uno?"
          action={canCreate ? <NewOrderModal /> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const cutoffLabel = cutoffShortLabel(
              (order as Record<string, unknown>).custom_cutoff_at as string | null
            );
            return (
              <Link key={order.id} href={`/mi-portal/pedidos/${order.id}`}>
                <Card className="hover:border-sheina-600/40 hover:shadow-soft transition-all duration-200 cursor-pointer">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900 text-sm truncate">{order.week_label}</p>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">
                        {formatART(order.created_at, "dd MMM yyyy")} · {order.total_units} viandas
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {cutoffLabel && (
                        <p className="hidden sm:block text-xs text-sheina-600 font-medium">{cutoffLabel}</p>
                      )}
                      <p className="hidden sm:block text-xs font-mono text-stone-400">{order.order_code}</p>
                      <OrderStatusBadge status={order.status as OrderStatus} />
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
