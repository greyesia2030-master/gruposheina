import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  pedido_confirmacion: "Confirmación",
  pedido_modificacion: "Modificación",
  facturacion: "Facturación",
  soporte: "Soporte",
  recordatorio_pago: "Recordatorio",
  entrega_notificacion: "Entrega",
  otro: "Otro",
};

export default async function MensajesPage() {
  const supabase = await createSupabaseServer();

  const { data: threads } = await supabase
    .from("communication_threads")
    .select(`
      id, subject, status, category, last_message_at, unread_count,
      organizations(id, name, member_id)
    `)
    .order("last_message_at", { ascending: false })
    .limit(50);

  const list = (threads ?? []) as unknown as Array<{
    id: string;
    subject: string | null;
    status: string;
    category: string;
    last_message_at: string;
    unread_count: number;
    organizations: { id: string; name: string; member_id: string | null } | null;
  }>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mensajes</h1>
        <span className="text-sm text-gray-500">{list.length} conversaciones</span>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        {list.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm">No hay conversaciones todavía</p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map((thread) => {
              const orgInitial = thread.organizations?.name?.charAt(0)?.toUpperCase() ?? "?";
              const isUnread = thread.unread_count > 0;

              return (
                <Link
                  key={thread.id}
                  href={`/mensajes/${thread.id}`}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#D4622B]/10 text-[#D4622B] flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                    {orgInitial}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`truncate ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {thread.organizations?.name ?? "Sin organización"}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {new Date(thread.last_message_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate flex-1 ${isUnread ? "text-gray-700" : "text-gray-500"}`}>
                        {thread.subject ?? "Sin asunto"}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {CATEGORY_LABELS[thread.category] ?? thread.category}
                      </span>
                    </div>
                  </div>

                  {/* Unread badge */}
                  {isUnread && (
                    <span className="w-5 h-5 rounded-full bg-[#D4622B] text-white text-xs flex items-center justify-center flex-shrink-0 font-medium">
                      {thread.unread_count > 9 ? "9+" : thread.unread_count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
