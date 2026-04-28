"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Copy, Check, ExternalLink } from "lucide-react";
import {
  getPublishedMenusAndDepts,
  createOrderAsClientAdmin,
} from "@/app/actions/portal-cliente";

type Menu = { id: string; week_label: string; week_start: string; week_number: number };
type Dept = { id: string; name: string };

type Step = "trigger" | "form" | "loading" | "result" | "error";

interface Result {
  orderId: string;
  orderCode: string;
  formToken: string;
  shareUrl: string;
}

export function NewOrderModal() {
  const [step, setStep] = useState<Step>("trigger");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [weekLabel, setWeekLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function openModal() {
    setStep("loading");
    setErrorMsg("");
    const res = await getPublishedMenusAndDepts();
    if (!res.ok) {
      setErrorMsg(res.error);
      setStep("error");
      return;
    }
    setMenus(res.data.menus);
    setDepartments(res.data.departments);
    const first = res.data.menus[0];
    if (first) {
      setSelectedMenuId(first.id);
      setWeekLabel(first.week_label);
    }
    setStep("form");
  }

  function closeModal() {
    setStep("trigger");
    setResult(null);
    setErrorMsg("");
    setCopied(false);
  }

  function handleMenuChange(menuId: string) {
    setSelectedMenuId(menuId);
    const menu = menus.find((m) => m.id === menuId);
    if (menu) setWeekLabel(menu.week_label);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMenuId || !weekLabel.trim()) return;
    setStep("loading");

    const res = await createOrderAsClientAdmin({
      menuId: selectedMenuId,
      weekLabel: weekLabel.trim(),
    });

    if (!res.ok) {
      setErrorMsg(res.error);
      setStep("error");
      return;
    }

    const shareUrl = `${window.location.origin}/pedido/${res.data.formToken}`;
    setResult({ ...res.data, shareUrl });
    setStep("result");
    router.refresh();
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "trigger") {
    return (
      <button
        onClick={openModal}
        className="rounded-xl bg-[#D4622B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b85224] transition-colors"
      >
        Nuevo pedido
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          {/* Loading */}
          {step === "loading" && (
            <div className="py-12 text-center">
              <p className="text-sm text-stone-500">Cargando…</p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div>
              <h2 className="text-lg font-heading font-light text-stone-900 mb-4">Error</h2>
              <p className="text-sm text-red-600 mb-6">{errorMsg}</p>
              <button
                onClick={closeModal}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Form */}
          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-heading font-light text-stone-900 mb-5">Nuevo pedido</h2>

              {/* Menu select */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Menú semanal
                </label>
                {menus.length === 0 ? (
                  <p className="text-sm text-stone-400 italic">No hay menús publicados disponibles.</p>
                ) : menus.length === 1 ? (
                  <p className="text-sm font-medium text-stone-800">{menus[0].week_label}</p>
                ) : (
                  <select
                    value={selectedMenuId}
                    onChange={(e) => handleMenuChange(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#D4622B] focus:ring-2 focus:ring-[#D4622B]/15"
                  >
                    {menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.week_label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Week label input */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Etiqueta del pedido
                </label>
                <input
                  type="text"
                  value={weekLabel}
                  onChange={(e) => setWeekLabel(e.target.value)}
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#D4622B] focus:ring-2 focus:ring-[#D4622B]/15"
                />
              </div>

              {/* Departments hint */}
              {departments.length > 0 && (
                <div className="mb-5 bg-stone-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-stone-500">
                    Se van a crear secciones automáticamente para:{" "}
                    <span className="font-medium text-stone-700">
                      {departments.map((d) => d.name).join(", ")}
                    </span>
                  </p>
                </div>
              )}

              {menus.length === 0 ? null : (
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-[#D4622B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b85224] transition-colors"
                  >
                    Crear pedido
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Result */}
          {step === "result" && result && (
            <div>
              <h2 className="text-xl font-heading font-light text-stone-900 mb-1">
                ¡Pedido creado!
              </h2>
              <p className="text-xs font-mono text-stone-400 mb-5">{result.orderCode}</p>

              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Link de carga para tu equipo
              </p>
              <p className="text-xs font-mono text-stone-600 bg-stone-50 rounded-lg px-3 py-2 break-all mb-3">
                {result.shareUrl}
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "¡Copiado!" : "Copiar link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hola! Cargá tu pedido de viandas para ${result.orderCode}: ${result.shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Pedido de viandas ${result.orderCode}`)}&body=${encodeURIComponent(`Hola,\n\nPor favor cargá tu pedido de viandas para ${result.orderCode}:\n${result.shareUrl}`)}`}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Email
                </a>
              </div>

              <button
                onClick={() => router.push(`/mi-portal/pedidos/${result.orderId}`)}
                className="w-full rounded-xl bg-[#D4622B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b85224] transition-colors"
              >
                Ver pedido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
