"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getSharedFormData, joinSection } from "@/app/actions/shared-form-public";
import type { FormUser } from "@/app/actions/shared-form-public";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";

const ERROR_MESSAGES: Record<string, string> = {
  expired: "Este link venció. Pedí uno nuevo al administrador.",
  maxed_out: "Este link ya alcanzó el límite de usos.",
  invalid: "Link inválido o no encontrado.",
};

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-[#D4622B]/15 text-[#D4622B] flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

export default function SharedOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tokenError, setTokenError] = useState("");
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<FormUser[]>([]);
  const [requireContact, setRequireContact] = useState(true);
  const [cutoffAt, setCutoffAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");

  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedUser, setSelectedUser] = useState<FormUser | null>(null);
  const [formMode, setFormMode] = useState<"picker" | "manual">("picker");
  const [participantName, setParticipantName] = useState("");
  const [memberContact, setMemberContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSharedFormData(token)
      .then((result) => {
        if (!result.ok) {
          setTokenError(ERROR_MESSAGES[result.error] ?? "Error inesperado.");
          setStatus("error");
        } else {
          setSections(result.data.sectionNames);
          setRequireContact(result.data.requireContact);
          setUsers(result.data.users);
          setCutoffAt(result.data.cutoffAt);
          setFormMode(result.data.users.length > 0 ? "picker" : "manual");
          setStatus("ready");
        }
      })
      .catch((err) => {
        console.error("[SharedForm] Error:", err);
        setTokenError("Error al conectar con el servidor. Intentá de nuevo.");
        setStatus("error");
      });
  }, [token]);

  // Countdown timer — solo si el corte es dentro de las próximas 24h
  useEffect(() => {
    if (!cutoffAt) return;
    const cutoffMs = new Date(cutoffAt).getTime();
    const update = () => {
      const remaining = cutoffMs - Date.now();
      if (remaining <= 0) {
        setCountdown("00:00:00");
        return;
      }
      if (remaining > 24 * 60 * 60 * 1000) {
        setCountdown("");
        return;
      }
      const totalSec = Math.floor(remaining / 1000);
      const hh = Math.floor(totalSec / 3600);
      const mm = Math.floor((totalSec % 3600) / 60);
      const ss = totalSec % 60;
      setCountdown([hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":"));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [cutoffAt]);

  const handleSubmit = async () => {
    const usingPicker = formMode === "picker" && selectedUser;
    if (!selectedSectionId) return;
    if (!usingPicker && participantName.trim().length < 2) return;
    if (!usingPicker && requireContact && !memberContact.trim()) return;
    setSubmitting(true);

    const result = await joinSection(
      token,
      selectedSectionId,
      usingPicker ? selectedUser.full_name : participantName.trim(),
      usingPicker ? (selectedUser.email ?? selectedUser.phone ?? undefined) : (memberContact.trim() || undefined),
      usingPicker ? selectedUser.id : undefined
    );

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

  const usingPicker = formMode === "picker" && users.length > 0;
  const contactFilled = !requireContact || memberContact.trim().length > 0;
  const canSubmit =
    !!selectedSectionId &&
    (usingPicker ? !!selectedUser : participantName.trim().length >= 2 && contactFilled) &&
    !submitting;

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Armá tu pedido</h1>
      <p className="text-sm text-gray-500 mb-8">
        Elegí tu sector{usingPicker ? " y seleccioná tu nombre" : " e ingresá tu nombre"} para empezar.
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

      {/* User picker (when org has users configured) */}
      {usingPicker ? (
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-3">¿Quién sos?</p>
          <div className="space-y-2 mb-3">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUser(u)}
                className={`w-full flex items-center gap-3 p-3 border rounded-lg transition-colors text-left ${
                  selectedUser?.id === u.id
                    ? "border-[#D4622B] bg-orange-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <UserAvatar name={u.full_name} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                  {u.email && (
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  )}
                </div>
                {selectedUser?.id === u.id && (
                  <div className="ml-auto w-4 h-4 rounded-full bg-[#D4622B] flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setFormMode("manual"); setSelectedUser(null); }}
            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
          >
            No estoy en la lista
          </button>
        </div>
      ) : (
        <>
          {/* Manual name + contact inputs */}
          <div className="mb-4">
            <Input
              label="Tu nombre"
              placeholder="Ej: Juan Pérez"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="mb-4">
            <Input
              label={requireContact ? "Email o teléfono *" : "Email o teléfono (opcional)"}
              placeholder="ej: juan@empresa.com o 1123456789"
              value={memberContact}
              onChange={(e) => setMemberContact(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 mt-1">
              Para que podamos contactarte si hace falta
            </p>
          </div>
          {users.length > 0 && (
            <div className="mb-8">
              <button
                type="button"
                onClick={() => { setFormMode("picker"); setParticipantName(""); setMemberContact(""); }}
                className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
              >
                ← Volver a la lista
              </button>
            </div>
          )}
          {users.length === 0 && <div className="mb-8" />}
        </>
      )}

      {/* Countdown banner — solo si el corte es en <24h */}
      {countdown && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${
          countdown === "00:00:00"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          <span>
            {countdown === "00:00:00"
              ? "El tiempo para enviar tu pedido expiró"
              : "Tiempo restante para enviar"}
          </span>
          {countdown !== "00:00:00" && (
            <span className="font-mono font-semibold">{countdown}</span>
          )}
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={!canSubmit || countdown === "00:00:00"}
        loading={submitting}
      >
        Empezar a cargar
      </Button>
    </div>
  );
}
