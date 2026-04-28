import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { OrderStatus } from "@/lib/types/database";

export default async function MiPortalPage() {
  const currentUser = await requireUser();
  if (!currentUser.organizationId) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-heading font-light mb-2">Mi Portal</h1>
        <p className="text-stone-500 text-sm">Tu cuenta no está vinculada a ninguna organización.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServer();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, total_units, created_at")
    .eq("organization_id", currentUser.organizationId)
    .in("status", ["draft", "confirmed", "in_production", "awaiting_confirmation"])
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", currentUser.organizationId)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-heading font-light text-stone-900 mb-1">
        Bienvenido{currentUser.fullName ? `, ${currentUser.fullName.split(" ")[0]}` : ""}
      </h1>
      {org?.name && (
        <p className="text-sm text-stone-400 mb-8">{org.name}</p>
      )}

      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">
        Pedidos activos
      </h2>

      {!orders || orders.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <ShoppingBag className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">No hay pedidos activos en este momento.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/mi-portal/pedidos/${order.id}`}>
              <Card className="hover:border-[#D4622B]/40 transition-colors cursor-pointer">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-stone-900">{order.week_label}</p>
                    <p className="text-xs text-stone-400 font-mono mt-0.5">{order.order_code}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-stone-500">
                      {order.total_units} viandas
                    </p>
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
