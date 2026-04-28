import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft, Users, Share2 } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { CopyButton } from "@/components/portal-cliente/copy-button";

export default async function MiPortalParticipantesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await requireUser();
  if (!currentUser.organizationId) notFound();

  // Verify order belongs to user's org
  const supabase = await createSupabaseServer();
  const { data: order } = await supabase
    .from("orders")
    .select("id, week_label, status")
    .eq("id", id)
    .eq("organization_id", currentUser.organizationId)
    .single();

  if (!order) notFound();

  const db = createAdminClient();

  // Get active form token for share link
  const { data: token } = await db
    .from("order_form_tokens")
    .select("token")
    .eq("order_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let shareUrl: string | null = null;
  if (token) {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = host.includes("localhost") ? "http" : "https";
    shareUrl = `${proto}://${host}/pedido/${token.token}`;
  }

  // Query sections
  const { data: sections } = await db
    .from("order_sections")
    .select("id, name, display_order, total_quantity")
    .eq("order_id", id)
    .order("display_order");

  // Query submitted participants only
  const sectionIds = (sections ?? []).map((s) => s.id);
  const participantsResult =
    sectionIds.length > 0
      ? await db
          .from("order_participants")
          .select("id, section_id, display_name, submitted_at, total_quantity")
          .in("section_id", sectionIds)
          .not("submitted_at", "is", null)
          .order("submitted_at")
      : null;
  const participants = participantsResult?.data ?? [];

  // Group participants by section_id
  type Participant = (typeof participants)[number];
  const bySection = ((participants ?? []) as Participant[]).reduce<
    Record<string, Participant[]>
  >((acc, p) => {
    if (!p) return acc;
    (acc[p.section_id] ??= []).push(p);
    return acc;
  }, {});

  const totalSubmitted = (participants ?? []).length;

  return (
    <div className="max-w-xl">
      <Link
        href={`/mi-portal/pedidos/${id}`}
        className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Detalle del pedido
      </Link>

      <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Participantes</p>
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-6">
        {order.week_label}
      </h1>

      {shareUrl && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-stone-400" />
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Link del formulario
            </p>
          </div>
          <p className="text-xs font-mono text-stone-500 bg-stone-50 rounded-lg px-3 py-2 mb-2 break-all">
            {shareUrl}
          </p>
          <CopyButton text={shareUrl} label="Copiar link" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-stone-400" />
        <p className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900">{totalSubmitted}</span>{" "}
          participante{totalSubmitted !== 1 ? "s" : ""} confirmado
          {totalSubmitted !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-4">
        {(sections ?? []).map((section) => {
          const sectionParticipants = bySection[section.id] ?? [];
          return (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-stone-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
                <p className="text-sm font-medium text-stone-700">{section.name}</p>
                <span className="text-xs text-stone-400">
                  {sectionParticipants.length} persona
                  {sectionParticipants.length !== 1 ? "s" : ""}
                </span>
              </div>
              {sectionParticipants.length > 0 ? (
                <ul className="divide-y divide-stone-50">
                  {sectionParticipants.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-sm text-stone-800">{p.display_name}</span>
                      <span className="text-xs text-stone-400">
                        {p.total_quantity} vianda
                        {p.total_quantity !== 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-xs text-stone-400 italic">
                  Sin participantes aún.
                </p>
              )}
            </div>
          );
        })}

        {!sections?.length && (
          <p className="text-sm text-stone-400 italic">
            No hay secciones configuradas para este pedido.
          </p>
        )}
      </div>
    </div>
  );
}
