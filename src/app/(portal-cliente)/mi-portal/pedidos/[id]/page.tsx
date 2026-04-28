import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/badge";
import { formatART } from "@/lib/utils/timezone";
import Link from "next/link";
import { ChevronLeft, Users, ShoppingCart } from "lucide-react";
import type { OrderStatus } from "@/lib/types/database";
import { CloseOrderButton } from "@/components/portal-cliente/close-order-button";
import { CopyButton } from "@/components/portal-cliente/copy-button";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes",
};

export default async function MiPortalPedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await requireUser();
  if (!currentUser.organizationId) notFound();

  const supabase = await createSupabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, total_units, created_at, organization_id, form_token_id")
    .eq("id", id)
    .eq("organization_id", currentUser.organizationId)
    .single();

  if (!order) notFound();

  // Share link — only if a form token is linked to this order
  let shareUrl: string | null = null;
  if (order.form_token_id) {
    const db = createAdminClient();
    const { data: tokenRow } = await db
      .from("order_form_tokens")
      .select("token")
      .eq("id", order.form_token_id)
      .eq("is_active", true)
      .maybeSingle();
    if (tokenRow) {
      const hdrs = await headers();
      const host = hdrs.get("host") ?? "localhost:3000";
      const proto = host.includes("localhost") ? "http" : "https";
      shareUrl = `${proto}://${host}/pedido/${tokenRow.token}`;
    }
  }

  const { data: lines } = await supabase
    .from("order_lines")
    .select("day_of_week, display_name, quantity, option_code")
    .eq("order_id", id)
    .order("day_of_week")
    .order("option_code");

  const byDay = (lines ?? []).reduce<Record<number, typeof lines>>((acc, l) => {
    if (!l) return acc;
    (acc[l.day_of_week] ??= []).push(l);
    return acc;
  }, {});

  const totalQty = (lines ?? []).reduce((s, l) => s + (l?.quantity ?? 0), 0);

  return (
    <div className="max-w-xl">
      <Link
        href="/mi-portal/pedidos"
        className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis pedidos
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-light text-stone-900">{order.week_label}</h1>
          <p className="text-xs font-mono text-stone-400 mt-1">{order.order_code}</p>
        </div>
        <OrderStatusBadge status={order.status as OrderStatus} />
      </div>

      {shareUrl && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-medium text-stone-600 mb-1.5">
            Link de carga para tu equipo
          </p>
          <p className="text-xs font-mono text-stone-500 break-all mb-2">{shareUrl}</p>
          <div className="flex flex-wrap gap-3">
            <CopyButton text={shareUrl} label="Copiar link" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola! Cargá tu pedido de viandas para ${order.order_code}: ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(`Pedido de viandas ${order.order_code}`)}&body=${encodeURIComponent(`Hola,\n\nPor favor cargá tu pedido de viandas para ${order.order_code}:\n${shareUrl}`)}`}
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              Email
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-stone-400 mb-1">Total viandas</p>
            <p className="text-2xl font-bold text-stone-900">{totalQty}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-stone-400 mb-1">Creado</p>
            <p className="text-sm font-medium text-stone-700">
              {formatART(order.created_at, "dd MMM yyyy")}
            </p>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link
            href={`/mi-portal/pedidos/${id}/participantes`}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <Users className="h-4 w-4" />
            Ver participantes
          </Link>
          {["draft", "partially_filled", "awaiting_confirmation"].includes(order.status) &&
            ["client_admin", "superadmin", "admin"].includes(currentUser.role) && (
            <Link
              href={`/mi-portal/pedidos/${id}/cargar`}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Cargar mi pedido
            </Link>
          )}
        </div>
        {["draft", "partially_filled"].includes(order.status) && (
          <CloseOrderButton orderId={order.id} />
        )}
      </div>

      {lines && lines.length > 0 ? (
        <Card>
          <div className="divide-y divide-stone-100">
            {Object.entries(byDay)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([dayNum, dayLines]) => (
                <div key={dayNum} className="px-4 py-3">
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                    {DAY_NAMES[Number(dayNum)]}
                  </p>
                  {(dayLines ?? []).map((l, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-stone-700">{l?.display_name}</span>
                      <span className="font-medium text-stone-900">{l?.quantity}×</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </Card>
      ) : (
        <Card>
          <p className="p-6 text-center text-stone-400 text-sm">Sin detalle de líneas disponible.</p>
        </Card>
      )}
    </div>
  );
}
