import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft, Share2, CheckCircle, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { OrderStatusBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/portal-cliente/copy-button";
import type { OrderStatus } from "@/lib/types/database";

export default async function MiPortalEquipoPage() {
  const currentUser = await requireUser();
  if (!currentUser.organizationId) redirect("/mi-portal/pedidos");
  if (!["client_admin", "superadmin", "admin"].includes(currentUser.role)) {
    redirect("/mi-portal/pedidos");
  }

  const supabase = await createSupabaseServer();
  const db = createAdminClient();

  // Pedido activo más reciente de la org
  const { data: order } = await supabase
    .from("orders")
    .select("id, week_label, order_code, status, form_token_id")
    .eq("organization_id", currentUser.organizationId)
    .in("status", ["draft", "awaiting_confirmation", "confirmed", "in_production"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) {
    return (
      <div className="max-w-xl">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Equipo</p>
        <h1 className="text-2xl font-heading font-light text-stone-900 mb-8">Estado de carga</h1>
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <p className="text-stone-500 text-sm">
            No hay pedido vigente. Cuando crees uno, vas a ver acá quiénes ya cargaron.
          </p>
        </div>
      </div>
    );
  }

  // Token activo para link compartible
  const { data: tokenRow } = await db
    .from("order_form_tokens")
    .select("token")
    .eq("order_id", order.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let shareUrl: string | null = null;
  if (tokenRow) {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = host.includes("localhost") ? "http" : "https";
    shareUrl = `${proto}://${host}/pedido/${tokenRow.token}`;
  }

  // Secciones del pedido
  const { data: sections } = await db
    .from("order_sections")
    .select("id, name, display_order, expected_participants, closed_at, total_quantity")
    .eq("order_id", order.id)
    .order("display_order");

  // Todos los participantes (incluyendo no-submitted para mostrar "cargando...")
  const sectionIds = (sections ?? []).map((s) => s.id);
  const participantsResult =
    sectionIds.length > 0
      ? await db
          .from("order_participants")
          .select("id, section_id, display_name, member_contact, submitted_at, total_quantity")
          .in("section_id", sectionIds)
          .order("submitted_at", { ascending: true, nullsFirst: false })
      : null;
  const participants = participantsResult?.data ?? [];

  // Agrupar por section_id
  type Participant = (typeof participants)[number];
  const bySection = participants.reduce<Record<string, Participant[]>>((acc, p) => {
    (acc[p.section_id] ??= []).push(p);
    return acc;
  }, {});

  const totalSubmitted = participants.filter((p) => p.submitted_at !== null).length;
  const totalExpected = (sections ?? []).reduce(
    (s, sec) => s + (sec.expected_participants ?? 0),
    0
  );

  return (
    <div className="max-w-xl">
      <Link
        href="/mi-portal/pedidos"
        className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Mis pedidos
      </Link>

      <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Equipo</p>
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-2xl font-heading font-light text-stone-900">{order.week_label}</h1>
        <OrderStatusBadge status={order.status as OrderStatus} />
      </div>
      <p className="text-xs font-mono text-stone-400 mb-6">{order.order_code}</p>

      <div className="bg-white rounded-xl border border-stone-200 px-4 py-3 mb-6 flex items-center justify-between">
        <p className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900">{totalSubmitted}</span>
          {" de "}
          <span className="font-semibold text-stone-900">{totalExpected}</span>
          {" colaboradores cargaron"}
        </p>
        {shareUrl && <CopyButton text={shareUrl} label="Copiar link" />}
      </div>

      <div className="space-y-4">
        {(sections ?? []).map((section) => {
          const sectionParticipants = bySection[section.id] ?? [];
          const submittedCount = sectionParticipants.filter((p) => p.submitted_at !== null).length;
          const isClosed = !!section.closed_at;

          return (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-stone-200 overflow-hidden"
            >
              {/* Section header */}
              <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{section.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Esperados: {section.expected_participants ?? "—"} · Cargados: {submittedCount}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    isClosed ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {isClosed ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      cerrado
                    </>
                  ) : (
                    <>
                      <Clock className="h-3.5 w-3.5" />
                      pendiente
                    </>
                  )}
                </span>
              </div>

              {/* Participant list */}
              {sectionParticipants.length > 0 ? (
                <ul className="divide-y divide-stone-50">
                  {sectionParticipants.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-base leading-none">
                        {p.submitted_at !== null ? "✅" : "🟡"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800 truncate">{p.display_name}</p>
                        {p.member_contact && (
                          <p className="text-xs text-stone-400 truncate">{p.member_contact}</p>
                        )}
                      </div>
                      <span className="text-xs text-stone-400 shrink-0">
                        {p.submitted_at !== null
                          ? `${p.total_quantity} vianda${p.total_quantity !== 1 ? "s" : ""}`
                          : "(cargando…)"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-stone-400 mb-2">Sin cargas todavía.</p>
                  {shareUrl && (
                    <div className="flex justify-center">
                      <CopyButton text={shareUrl} label="Compartir link de carga" />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!sections?.length && (
          <p className="text-sm text-stone-400 italic text-center py-8">
            No hay secciones configuradas para este pedido.
          </p>
        )}
      </div>

      {shareUrl && (
        <div className="mt-6 bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-stone-400" />
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Link del formulario
            </p>
          </div>
          <p className="text-xs font-mono text-stone-500 bg-stone-50 rounded-lg px-3 py-2 mb-2 break-all">
            {shareUrl}
          </p>
          <CopyButton text={shareUrl} label="Copiar link completo" />
        </div>
      )}
    </div>
  );
}
