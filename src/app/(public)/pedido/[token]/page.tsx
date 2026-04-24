"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getSharedFormData, joinSection } from "@/app/actions/shared-form-public";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";

const ERROR_MESSAGES: Record<string, string> = {
  expired: "Este link venció. Pedí uno nuevo al administrador.",
  maxed_out: "Este link ya alcanzó el límite de usos.",
  invalid: "Link inválido o no encontrado.",
};

export default function SharedOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tokenError, setTokenError] = useState("");
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSharedFormData(token)
      .then((result) => {
        if (!result.ok) {
          setTokenError(ERROR_MESSAGES[result.error] ?? "Error inesperado.");
          setStatus("error");
        } else {
          setSections(result.data.sectionNames);
          setStatus("ready");
        }
      })
      .catch((err) => {
        console.error("[SharedForm] Error:", err);
        setTokenError("Error al conectar con el servidor. Intentá de nuevo.");
        setStatus("error");
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!selectedSectionId || participantName.trim().length < 2) return;
    setSubmitting(true);
    const result = await joinSection(token, selectedSectionId, participantName.trim());
    if (!result.ok) {
      toast(result.error || "Error al registrar participante", "error");
      setSubmitting(false);
      return;
    }
    localStorage.setItem(`access_token_${token}`, result.data.access_token);
    router.push(`/pedido/${token}/menu`);
  };

  if (status === "loading") return <PageLoading />;

  if (status === "error") {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Link no disponible</h1>
        <p className="text-gray-500 text-sm">{tokenError}</p>
      </div>
    );
  }

  const canSubmit = !!selectedSectionId && participantName.trim().length >= 2 && !submitting;

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Armá tu pedido</h1>
      <p className="text-sm text-gray-500 mb-8">
        Elegí tu sector e ingresá tu nombre para empezar.
      </p>

      {/* SectionPicker */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">¿De qué sector sos?</p>
        <div className="space-y-2">
          {sections.map((s) => (
            <label
              key={s.id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedSectionId === s.id
                  ? "border-[#D4622B] bg-orange-50"
                  : "border-gray-200 hover:bg-gray-50"
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
              <span className="text-sm font-medium text-gray-800">{s.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* NameInputCard */}
      <div className="mb-8">
        <Input
          label="Tu nombre"
          placeholder="Ej: Juan Pérez"
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          maxLength={100}
        />
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={!canSubmit}
        loading={submitting}
      >
        Empezar a cargar
      </Button>
    </div>
  );
}
