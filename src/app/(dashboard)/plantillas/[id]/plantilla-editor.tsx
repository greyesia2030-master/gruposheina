"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertCommunicationTemplate } from "@/app/actions/communications";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import type { CommunicationTemplate, CommunicationChannel, CommunicationCategory } from "@/lib/types/database";

const CHANNEL_OPTIONS: { value: CommunicationChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "web_note", label: "Nota interna" },
  { value: "phone_call_note", label: "Llamada" },
];

const CATEGORY_OPTIONS: { value: CommunicationCategory; label: string }[] = [
  { value: "pedido_confirmacion", label: "Confirmación de pedido" },
  { value: "pedido_modificacion", label: "Modificación de pedido" },
  { value: "facturacion", label: "Facturación" },
  { value: "soporte", label: "Soporte" },
  { value: "recordatorio_pago", label: "Recordatorio de pago" },
  { value: "entrega_notificacion", label: "Notificación de entrega" },
  { value: "otro", label: "Otro" },
];

const PREVIEW_VARS: Record<string, string> = {
  organizationName: "Pilo Enterprise",
  memberId: "VIA-00001",
  orderNumber: "PED-042",
  deliveryDate: "lunes 28 de abril",
  totalAmount: "$45.000",
  formLink: "https://app.gruposheina.com.ar/pedido/abc123",
};

function interpolate(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => PREVIEW_VARS[key] ?? `{{${key}}}`);
}

interface FormState {
  name: string;
  channel: CommunicationChannel;
  category: CommunicationCategory;
  subject: string;
  body: string;
  is_active: boolean;
}

export function PlantillaEditor({
  template,
  templateId,
}: {
  template: CommunicationTemplate | null;
  templateId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    name: template?.name ?? "",
    channel: template?.channel ?? "email",
    category: template?.category ?? "otro",
    subject: template?.subject ?? "",
    body: template?.body ?? "",
    is_active: template?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    setPreview(interpolate(form.body));
  }, [form.body]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast("El nombre es obligatorio", "error");
      return;
    }
    if (!form.body.trim()) {
      toast("El cuerpo es obligatorio", "error");
      return;
    }
    setSaving(true);
    const result = await upsertCommunicationTemplate(templateId, {
      name: form.name.trim(),
      channel: form.channel,
      category: form.category,
      subject: form.subject.trim() || null,
      body: form.body.trim(),
      is_active: form.is_active,
    });
    setSaving(false);
    if (result.ok) {
      toast("Plantilla guardada", "success");
      router.push("/plantillas");
    } else {
      toast(result.error, "error");
    }
  };

  const previewSubject = interpolate(form.subject);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {templateId ? "Editar plantilla" : "Nueva plantilla"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Confirmación de pedido semanal"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as CommunicationChannel })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
              >
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as CommunicationCategory })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.channel !== "whatsapp" && form.channel !== "sms" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto (email)</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ej: Tu pedido {{orderNumber}} para {{deliveryDate}}"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cuerpo{" "}
              <span className="text-gray-400 font-normal">
                — usar <code className="text-xs bg-gray-100 px-1 rounded">{"{{variable}}"}</code>
              </span>
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={12}
              placeholder="Hola {{organizationName}},&#10;&#10;Tu pedido {{orderNumber}} está confirmado..."
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="accent-[#D4622B]"
            />
            <span className="text-sm text-gray-700">Plantilla activa</span>
          </label>

          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
              loading={saving}
            >
              Guardar
            </Button>
            <button
              onClick={() => router.push("/plantillas")}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Preview — datos de ejemplo
          </h2>
          <div className="border rounded-xl p-4 bg-white min-h-64">
            {previewSubject && (
              <p className="text-xs font-medium text-gray-400 mb-3 pb-3 border-b">
                Asunto: {previewSubject}
              </p>
            )}
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{preview}</p>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Variables disponibles
            </p>
            <div className="space-y-1.5">
              {Object.entries(PREVIEW_VARS).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs gap-2">
                  <code className="text-[#D4622B] bg-orange-50 px-1.5 py-0.5 rounded">
                    {`{{${key}}}`}
                  </code>
                  <span className="text-gray-500 truncate">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
