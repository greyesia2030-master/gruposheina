import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const CHANNEL_LABELS: Record<string, string> = {
  email:           "Email",
  whatsapp:        "WhatsApp",
  sms:             "SMS",
  web_note:        "Nota interna",
  phone_call_note: "Llamada",
};

const CATEGORY_LABELS: Record<string, string> = {
  pedido_confirmacion:    "Confirmación de pedido",
  pedido_modificacion:    "Modificación",
  facturacion:            "Facturación",
  soporte:                "Soporte",
  recordatorio_pago:      "Recordatorio de pago",
  entrega_notificacion:   "Notificación de entrega",
  otro:                   "Otro",
};

const CHANNEL_VARIANT: Record<string, string> = {
  email:           "bg-blue-100 text-blue-700",
  whatsapp:        "bg-emerald-100 text-emerald-700",
  sms:             "bg-violet-100 text-violet-700",
  web_note:        "bg-stone-100 text-stone-600",
  phone_call_note: "bg-amber-100 text-amber-700",
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
    <div>
      <PageHeader
        title="Plantillas"
        action={
          <Link
            href="/plantillas/nueva"
            className="inline-flex items-center gap-2 rounded-xl bg-sheina-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:bg-sheina-700 active:scale-[0.98]"
          >
            + Nueva plantilla
          </Link>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin plantillas"
          description="Creá la primera plantilla de comunicación."
        />
      ) : (
        <Card>
          <div className="divide-y divide-stone-100">
            {list.map((template) => (
              <div key={template.id} className="px-5 py-4 flex items-start gap-4 hover:bg-sheina-50/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-stone-900">{template.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_VARIANT[template.channel] ?? "bg-stone-100 text-stone-600"}`}>
                      {CHANNEL_LABELS[template.channel] ?? template.channel}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
                      {CATEGORY_LABELS[template.category] ?? template.category}
                    </span>
                    {!template.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                        Inactiva
                      </span>
                    )}
                  </div>
                  {template.subject && (
                    <p className="text-sm text-stone-500 mb-0.5">
                      Asunto: <span className="text-stone-700">{template.subject}</span>
                    </p>
                  )}
                  <p className="text-sm text-stone-400 truncate">
                    {template.body.slice(0, 120)}{template.body.length > 120 ? "…" : ""}
                  </p>
                </div>
                <Link
                  href={`/plantillas/${template.id}`}
                  className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors flex-shrink-0"
                >
                  Editar
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
