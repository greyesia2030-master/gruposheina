import { PageHeader } from "@/components/layout/page-header";
import { MessageSquare, Sparkles, Clock, CheckCircle2 } from "lucide-react";

const ROADMAP_FEATURES = [
  {
    title: "Recepción de pedidos por WhatsApp",
    description: "Cliente envía mensaje, sistema crea pedido draft automáticamente con NLP",
    status: "Próximamente",
    icon: MessageSquare,
  },
  {
    title: "Notificaciones de estado al referente",
    description: "Confirmaciones, cambios de estado y recordatorios automáticos via WhatsApp Business",
    status: "Próximamente",
    icon: Clock,
  },
  {
    title: "Bandeja unificada admin",
    description: "Todas las conversaciones de clientes consolidadas con etiquetas, asignaciones y SLA",
    status: "Próximamente",
    icon: Sparkles,
  },
  {
    title: "Plantillas pre-aprobadas Meta",
    description: "Templates HSM para envíos masivos en cumplimiento con políticas de WhatsApp Business",
    status: "Próximamente",
    icon: CheckCircle2,
  },
];

export default function MensajesPage() {
  return (
    <div>
      <PageHeader
        title="Mensajes"
        breadcrumbs={[{ label: "Mensajes" }]}
      />

      <div className="max-w-4xl">
        {/* Hero */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-[#D4622B] rounded-xl p-3 flex-shrink-0">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 bg-amber-200 text-amber-900 text-xs font-medium px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="h-3 w-3" />
                Módulo en preparación
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">
                Centro de mensajes
              </h2>
              <p className="text-sm text-stone-700 mb-4">
                Próximamente vas a poder gestionar todas las comunicaciones con tus clientes
                desde un solo lugar: WhatsApp, email y SMS unificados con respuestas automáticas,
                plantillas y asignaciones por equipo.
              </p>
              <p className="text-xs text-stone-600">
                Disponible en la próxima fase del roadmap. Si necesitás priorizar este módulo,
                contactanos.
              </p>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="text-sm font-medium text-stone-700">Funcionalidades planificadas</h3>
          </div>
          <ul className="divide-y divide-stone-100">
            {ROADMAP_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title} className="px-6 py-4 flex items-start gap-4">
                  <div className="bg-stone-100 rounded-lg p-2 flex-shrink-0">
                    <Icon className="h-4 w-4 text-stone-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-stone-900">{f.title}</h4>
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex-shrink-0">
                        {f.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600">{f.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-xs text-stone-500 text-center">
          Mientras tanto, las notificaciones esenciales se envían por email (Resend) y push (PWA).
        </p>
      </div>
    </div>
  );
}
