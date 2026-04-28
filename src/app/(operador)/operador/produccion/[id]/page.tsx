import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ProductionCompleteButton } from "./production-complete-button";
import type { OrderStatus } from "@/lib/types/database";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes",
};

export default async function OperadorProduccionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createSupabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, total_units, organization:organizations(name)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { data: lines } = await supabase
    .from("order_lines")
    .select("day_of_week, display_name, option_code, quantity")
    .eq("order_id", id)
    .order("day_of_week")
    .order("option_code");

  const byDay = (lines ?? []).reduce<Record<number, typeof lines>>((acc, l) => {
    if (!l) return acc;
    (acc[l.day_of_week] ??= []).push(l);
    return acc;
  }, {});

  // Aggregate quantities per (day, option_code) for display
  const consolidated: Record<string, { display_name: string; day: number; qty: number }> = {};
  for (const l of lines ?? []) {
    if (!l) continue;
    const key = `${l.day_of_week}_${l.option_code}`;
    if (!consolidated[key]) {
      consolidated[key] = { display_name: l.display_name, day: l.day_of_week, qty: 0 };
    }
    consolidated[key].qty += l.quantity ?? 0;
  }

  const org = order.organization as unknown as { name: string } | null;
  const canComplete = order.status === "in_production";

  return (
    <div className="max-w-xl">
      <Link
        href="/operador/produccion"
        className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Producción
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-light text-stone-900">{org?.name ?? "Pedido"}</h1>
          <p className="text-stone-500 text-sm">{order.week_label}</p>
          <p className="text-xs font-mono text-stone-400">{order.order_code}</p>
        </div>
        <OrderStatusBadge status={order.status as OrderStatus} />
      </div>

      {/* Consolidated production quantities */}
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
        Detalle por día
      </h2>
      <Card className="mb-6">
        <div className="divide-y divide-stone-100">
          {Object.entries(
            Object.values(consolidated).reduce<Record<number, typeof consolidated[string][]>>(
              (acc, v) => { (acc[v.day] ??= []).push(v); return acc; },
              {}
            )
          )
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([dayNum, items]) => (
              <div key={dayNum} className="px-4 py-3">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                  {DAY_NAMES[Number(dayNum)]}
                </p>
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <span className="text-stone-700">{item.display_name}</span>
                    <span className="font-semibold text-stone-900">{item.qty}</span>
                  </div>
                ))}
              </div>
            ))}
          <div className="px-4 py-3 flex justify-between font-semibold text-stone-900">
            <span>Total</span>
            <span>{order.total_units} viandas</span>
          </div>
        </div>
      </Card>

      {canComplete && (
        <ProductionCompleteButton orderId={order.id} />
      )}
    </div>
  );
}
