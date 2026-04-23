import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉️",
  whatsapp: "💬",
  sms: "📱",
  web_note: "📝",
  phone_call_note: "📞",
};

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  delivered: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-600",
  read: "bg-purple-100 text-purple-700",
};

export default async function ClienteMensajesPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServer();

  const [{ data: org }, { data: communications }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, email, member_id, primary_contact_email")
      .eq("id", params.id)
      .single(),
    supabase
      .from("communications")
      .select("id, body, subject, direction, channel, status, created_at, sent_at, thread_id")
      .eq("organization_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const orgData = org as unknown as {
    id: string;
    name: string;
    email: string | null;
    member_id: string | null;
    primary_contact_email: string | null;
  } | null;

  const comms = (communications ?? []) as unknown as Array<{
    id: string;
    body: string;
    subject: string | null;
    direction: string;
    channel: string;
    status: string;
    created_at: string;
    sent_at: string | null;
    thread_id: string | null;
  }>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Client header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/clientes/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al cliente
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{orgData?.name ?? "Cliente"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {[orgData?.member_id, orgData?.primary_contact_email ?? orgData?.email]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {/* Stats bar */}
      {comms.length > 0 && (
        <div className="flex gap-4 mb-6 text-sm text-gray-600">
          <span>{comms.filter((c) => c.direction === "outbound").length} enviados</span>
          <span>{comms.filter((c) => c.direction === "inbound").length} recibidos</span>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {comms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">✉️</p>
            <p className="text-sm">No hay mensajes con este cliente todavía</p>
          </div>
        ) : (
          comms.map((comm) => (
            <div
              key={comm.id}
              className={`flex gap-3 ${comm.direction === "outbound" ? "flex-row-reverse" : ""}`}
            >
              {/* Channel icon */}
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0 mt-1">
                {CHANNEL_ICONS[comm.channel] ?? "📨"}
              </div>

              {/* Bubble */}
              <div
                className={`flex-1 max-w-sm px-4 py-3 rounded-xl text-sm border ${
                  comm.direction === "outbound"
                    ? "bg-[#D4622B]/5 border-[#D4622B]/20 ml-auto"
                    : "bg-white border-gray-200"
                }`}
              >
                {comm.subject && (
                  <p className="font-medium text-xs text-gray-400 mb-1">{comm.subject}</p>
                )}
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{comm.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">
                    {new Date(comm.created_at).toLocaleString("es-AR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      STATUS_STYLES[comm.status] ?? "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {comm.status}
                  </span>
                  {comm.thread_id && (
                    <Link
                      href={`/mensajes/${comm.thread_id}`}
                      className="text-xs text-[#D4622B] hover:underline ml-auto"
                    >
                      Ver hilo →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
