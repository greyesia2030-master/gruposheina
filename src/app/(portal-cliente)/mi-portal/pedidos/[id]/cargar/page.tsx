"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CheckCircle } from "lucide-react";
import {
  getOrderForCargar,
  submitOwnOrderAsClientAdmin,
  type CargarMenuItem,
  type CargarSection,
} from "@/app/actions/portal-cliente";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/loading";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes",
};

type Step = "section" | "menu" | "done";

export default function CargarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekLabel, setWeekLabel] = useState("");
  const [sections, setSections] = useState<CargarSection[]>([]);
  const [menuItems, setMenuItems] = useState<CargarMenuItem[]>([]);

  const [step, setStep] = useState<Step>("section");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    getOrderForCargar(id).then((res) => {
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setWeekLabel(res.data.order.week_label);
      setSections(res.data.sections);
      setMenuItems(res.data.menuItems);
    });
  }, [id]);

  const byDay = menuItems.reduce<Record<number, CargarMenuItem[]>>((acc, item) => {
    (acc[item.day_of_week] ??= []).push(item);
    return acc;
  }, {});

  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);

  async function handleSubmit() {
    setSubmitError("");
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    if (items.length === 0) {
      setSubmitError("Seleccioná al menos 1 vianda.");
      return;
    }

    setSubmitting(true);
    const res = await submitOwnOrderAsClientAdmin({
      orderId: id,
      sectionId: selectedSectionId,
      items,
    });
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    setStep("done");
  }

  if (loading) return <PageLoading />;

  if (error) {
    return (
      <div className="max-w-xl py-12 text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="text-stone-600 text-sm">{error}</p>
        <Link
          href={`/mi-portal/pedidos/${id}`}
          className="mt-4 inline-block text-sm text-stone-400 hover:text-stone-700 underline"
        >
          Volver al pedido
        </Link>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-xl py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-stone-900 mb-2">¡Pedido cargado!</h1>
        <p className="text-stone-500 text-sm mb-6">Tu selección fue registrada correctamente.</p>
        <Button onClick={() => router.push(`/mi-portal/pedidos/${id}`)}>
          Ver pedido
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <Link
        href={`/mi-portal/pedidos/${id}`}
        className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al pedido
      </Link>

      <h1 className="text-2xl font-heading font-light text-stone-900 mb-1">Cargar mi pedido</h1>
      <p className="text-sm text-stone-400 mb-8">{weekLabel}</p>

      {/* Step 1 — Elegir sección */}
      {step === "section" && (
        <div>
          <p className="text-sm font-medium text-stone-700 mb-3">¿De qué sector sos?</p>
          <div className="space-y-2 mb-6">
            {sections.map((s) => (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-3 min-h-11 border rounded-lg cursor-pointer transition-colors ${
                  selectedSectionId === s.id
                    ? "border-[#D4622B] bg-orange-50"
                    : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="section"
                  value={s.id}
                  checked={selectedSectionId === s.id}
                  onChange={() => setSelectedSectionId(s.id)}
                  className="accent-[#D4622B]"
                />
                <span className="text-sm font-medium text-stone-800">{s.name}</span>
              </label>
            ))}
          </div>
          <Button
            size="lg"
            className="w-full"
            disabled={!selectedSectionId}
            onClick={() => setStep("menu")}
          >
            Continuar
          </Button>
        </div>
      )}

      {/* Step 2 — Elegir viandas */}
      {step === "menu" && (
        <div>
          <div className="space-y-6 mb-6">
            {Object.entries(byDay)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([dayNum, items]) => (
                <div key={dayNum} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                      {DAY_NAMES[Number(dayNum)]}
                    </p>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 mr-4">
                          <p className="text-xs font-mono text-stone-400 mb-0.5">{item.option_code}</p>
                          <p className="text-sm text-stone-800">{item.display_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((q) => ({
                                ...q,
                                [item.id]: Math.max(0, (q[item.id] ?? 0) - 1),
                              }))
                            }
                            className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors flex items-center justify-center text-lg leading-none"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium text-stone-900">
                            {quantities[item.id] ?? 0}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((q) => ({
                                ...q,
                                [item.id]: Math.min(10, (q[item.id] ?? 0) + 1),
                              }))
                            }
                            className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors flex items-center justify-center text-lg leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {submitError && (
            <p className="text-sm text-red-600 mb-4">{submitError}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("section")}
              className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Atrás
            </button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || totalQty === 0}
              loading={submitting}
            >
              {submitting ? "Enviando…" : `Confirmar (${totalQty} vianda${totalQty !== 1 ? "s" : ""})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
