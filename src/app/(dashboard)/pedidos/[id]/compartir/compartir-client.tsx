"use client";

import { useState } from "react";
import { createOrderFormToken, deactivateOrderFormToken } from "@/app/actions/order-form-tokens";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface Participant {
  id: string;
}
interface Section {
  id: string;
  name: string;
  closed_at: string | null;
  total_quantity: number;
  display_order: number;
  order_participants: Participant[];
}
interface FormToken {
  id: string;
  token: string;
  valid_until: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
}
interface Order {
  id: string;
  status: string;
  organization_id: string;
  menu_id: string | null;
  organizations: { name: string; email: string | null; primary_contact_email: string | null } | null;
  order_form_tokens: FormToken[];
  order_sections: Section[];
}

export function CompartirClient({ order }: { order: Order | null }) {
  const { toast } = useToast();
  const [sections, setSections] = useState<string[]>(["Administración", "Ventas", "Logística"]);
  const [newSection, setNewSection] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diasValidez, setDiasValidez] = useState(7);
  const [maxParticipantes, setMaxParticipantes] = useState(50);
  const [requireContact, setRequireContact] = useState(true);

  if (!order) {
    return <p className="text-gray-500 py-12 text-center">Pedido no encontrado.</p>;
  }

  const activeToken =
    generatedToken == null
      ? order.order_form_tokens.find((t) => t.is_active)
      : null;

  const currentToken = generatedToken ?? activeToken?.token ?? null;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const displayLink = currentToken ? `${baseUrl}/pedido/${currentToken}` : null;

  const handleGenerate = async () => {
    setLoading(true);
    const result = await createOrderFormToken({
      organizationId: order.organization_id,
      menuId: order.menu_id,
      orderId: order.id,
      validUntil: new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000),
      maxUses: maxParticipantes,
      sectionNames: sections,
      requireContact,
    });
    if (result.ok) {
      setGeneratedToken(result.data.token);
    } else {
      toast(result.error, "error");
    }
    setLoading(false);
  };

  const handleRevoke = async () => {
    if (!activeToken) return;
    setRevoking(true);
    const result = await deactivateOrderFormToken(activeToken.id);
    if (result.ok) {
      toast("Link revocado", "success");
      window.location.reload();
    } else {
      toast(result.error, "error");
    }
    setRevoking(false);
  };

  const handleCopy = () => {
    if (!displayLink) return;
    navigator.clipboard.writeText(displayLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addSection = () => {
    const trimmed = newSection.trim();
    if (trimmed && !sections.includes(trimmed)) {
      setSections([...sections, trimmed]);
      setNewSection("");
    }
  };

  const hasExistingToken = !!activeToken;
  const sectionsInDb = order.order_sections
    .slice()
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-1">Compartir pedido</h1>
      <p className="text-gray-500 text-sm mb-8">
        Generá un link para que los empleados de{" "}
        <span className="font-medium text-gray-700">{order.organizations?.name}</span> carguen sus
        viandas.
      </p>

      {/* Link activo */}
      {displayLink ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
            Link activo
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white border border-green-200 px-3 py-2 rounded-lg break-all">
              {displayLink}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
            >
              {copied ? "✅ Copiado" : "Copiar"}
            </button>
          </div>
          {activeToken && (
            <div className="mt-3 flex items-center justify-between text-xs text-green-700">
              <span>
                {activeToken.used_count}/{activeToken.max_uses} usos · Vence{" "}
                {new Date(activeToken.valid_until).toLocaleDateString("es-AR")}
              </span>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                {revoking ? "Revocando…" : "Revocar link"}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Section manager — only shown before first generation */
        <>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Sectores del cliente</h2>
            <div className="space-y-2 mb-3">
              {sections.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-800">
                    {s}
                  </span>
                  <button
                    onClick={() => setSections(sections.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:text-red-700 text-sm px-2"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSection()}
                placeholder="Agregar sector…"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={addSection}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Link configuration */}
          <div className="mb-6 rounded-xl border bg-gray-50 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Configuración del link</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Días de validez
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={diasValidez}
                  onChange={(e) => setDiasValidez(Math.min(30, Math.max(1, Number(e.target.value))))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Máx. participantes
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxParticipantes}
                  onChange={(e) => setMaxParticipantes(Math.min(500, Math.max(1, Number(e.target.value))))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-700">Requerir email/teléfono</p>
                <p className="text-xs text-gray-500">Los participantes deben ingresar un contacto para auditoría</p>
              </div>
              <button
                type="button"
                onClick={() => setRequireContact(!requireContact)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  requireContact ? "bg-[#D4622B]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    requireContact ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </div>

          <Button
            size="lg"
            className="w-full mb-6"
            onClick={handleGenerate}
            disabled={loading || sections.length === 0}
            loading={loading}
          >
            Generar link compartido
          </Button>
        </>
      )}

      {/* Estado por sector (post-generación, desde DB) */}
      {sectionsInDb.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-700">Estado por sector</h2>
          </div>
          <div className="divide-y">
            {sectionsInDb.map((section) => (
              <div key={section.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{section.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {section.order_participants.length} participante
                    {section.order_participants.length !== 1 ? "s" : ""} ·{" "}
                    {section.total_quantity} viandas
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    section.closed_at
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {section.closed_at ? "Cerrado" : "Abierto"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasExistingToken && sectionsInDb.length === 0 && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Nadie se unió al pedido todavía.
        </p>
      )}
    </div>
  );
}
