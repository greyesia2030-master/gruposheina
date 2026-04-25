"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrganizationConfig } from "@/app/actions/organization-config";
import { Button } from "@/components/ui/button";
import type { Organization } from "@/lib/types/database";

const NOTIFICATION_KEYS = [
  "pedidos_por_email",
  "pedidos_por_whatsapp",
  "facturacion_por_email",
  "recordatorios_por_whatsapp",
  "soporte_por_whatsapp",
] as const;

const NOTIFICATION_LABELS: Record<string, string> = {
  pedidos_por_email: "Pedidos por email",
  pedidos_por_whatsapp: "Pedidos por WhatsApp",
  facturacion_por_email: "Facturación por email",
  recordatorios_por_whatsapp: "Recordatorios por WhatsApp",
  soporte_por_whatsapp: "Soporte por WhatsApp",
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2.5">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#D4622B]" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

export function ConfiguracionForm({ org }: { org: Organization }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [cutoffTime, setCutoffTime] = useState(org.cutoff_time ?? "18:00");
  const [cutoffDays, setCutoffDays] = useState(org.cutoff_days_before ?? 1);
  const [primaryEmail, setPrimaryEmail] = useState(org.primary_contact_email ?? "");
  const [secondaryEmailsRaw, setSecondaryEmailsRaw] = useState(
    (org.secondary_emails ?? []).join(", ")
  );
  const [prefersWebForm, setPrefersWebForm] = useState(org.prefers_web_form ?? false);
  const [departmentsRaw, setDepartmentsRaw] = useState(
    (org.departments ?? []).join(", ")
  );
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const key of NOTIFICATION_KEYS) defaults[key] = false;
    return { ...defaults, ...((org.notification_preferences as Record<string, boolean>) ?? {}) };
  });

  const handleSave = () => {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await updateOrganizationConfig(org.id, {
        cutoff_time: cutoffTime,
        cutoff_days_before: cutoffDays,
        primary_contact_email: primaryEmail.trim() || null,
        secondary_emails: secondaryEmailsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        prefers_web_form: prefersWebForm,
        notification_preferences: notifPrefs,
        departments: departmentsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">{org.name}</p>
        </div>
        <button
          onClick={() => router.push(`/clientes/${org.id}`)}
          className="text-sm text-[#D4622B] hover:underline"
        >
          ← Volver al cliente
        </button>
      </div>

      <div className="space-y-5">
        {/* Corte */}
        <section className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ventana de corte</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora de corte</label>
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Días antes del corte</label>
              <input
                type="number"
                min={0}
                max={7}
                value={cutoffDays}
                onChange={(e) => setCutoffDays(Math.min(7, Math.max(0, Number(e.target.value))))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </section>

        {/* Canal */}
        <section className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Canal de pedidos</h2>
          <Toggle
            label="Usa formulario web (en lugar de Excel por WhatsApp)"
            checked={prefersWebForm}
            onChange={setPrefersWebForm}
          />
        </section>

        {/* Contactos */}
        <section className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Contactos</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email principal (referente)</label>
              <input
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                placeholder="referente@empresa.com"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Emails secundarios (separados por coma)
              </label>
              <input
                type="text"
                value={secondaryEmailsRaw}
                onChange={(e) => setSecondaryEmailsRaw(e.target.value)}
                placeholder="otro@empresa.com, otro2@empresa.com"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </section>

        {/* Departamentos */}
        <section className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Departamentos / Sectores</h2>
          <input
            type="text"
            value={departmentsRaw}
            onChange={(e) => setDepartmentsRaw(e.target.value)}
            placeholder="Administración, Ventas, Logística"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Separados por coma</p>
        </section>

        {/* Notificaciones */}
        <section className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Notificaciones</h2>
          <div className="divide-y">
            {NOTIFICATION_KEYS.map((key) => (
              <Toggle
                key={key}
                label={NOTIFICATION_LABELS[key]}
                checked={notifPrefs[key] ?? false}
                onChange={(v) => setNotifPrefs((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </section>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-4 text-sm text-green-600">✓ Cambios guardados</p>}

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} loading={isPending} disabled={isPending}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
