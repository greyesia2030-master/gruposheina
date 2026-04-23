import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  web_note: "Nota interna",
  phone_call_note: "Llamada",
};

const CATEGORY_LABELS: Record<string, string> = {
  pedido_confirmacion: "Confirmación de pedido",
  pedido_modificacion: "Modificación",
  facturacion: "Facturación",
  soporte: "Soporte",
  recordatorio_pago: "Recordatorio de pago",
  entrega_notificacion: "Notificación de entrega",
  otro: "Otro",
};

export default async function PlantillasPage() {
  const supabase = await createSupabaseServer();

  const { data: templates } = await supabase
    .from("communication_templates")
    .select("id, name, channel, category, subject, body, is_active")
    .order("name");

  const list = (templates ?? []) as unknown as Array<{
    id: string;
    name: string;
    channel: string;
    category: string;
    subject: string | null;
    body: string;
    is_active: boolean;
  }>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de comunicación</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} plantillas</p>
        </div>
        <Link
          href="/plantillas/nueva"
          className="px-4 py-2 bg-[#D4622B] hover:bg-[#be5526] text-white rounded-lg font-medium text-sm transition-colors"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        {list.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No hay plantillas todavía</p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map((template) => (
              <div key={template.id} className="px-4 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {CHANNEL_LABELS[template.channel] ?? template.channel}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {CATEGORY_LABELS[template.category] ?? template.category}
                    </span>
                    {!template.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                        Inactiva
                      </span>
                    )}
                  </div>
                  {template.subject && (
                    <p className="text-sm text-gray-500 mb-0.5">
                      Asunto: <span className="text-gray-700">{template.subject}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-400 truncate">
                    {template.body.slice(0, 120)}
                    {template.body.length > 120 ? "…" : ""}
                  </p>
                </div>
                <Link
                  href={`/plantillas/${template.id}`}
                  className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  Editar
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
