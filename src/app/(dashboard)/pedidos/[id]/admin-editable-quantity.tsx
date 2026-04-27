"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAdminOverride } from "@/app/actions/orders";

interface Props {
  orderId: string;
  dayOfWeek: number;
  optionCode: string;
  currentTotal: number;
  hasOverride: boolean;
  disabled?: boolean;
}

function OverrideBadge() {
  return (
    <span className="ml-1.5 inline-block text-[10px] uppercase font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
      override
    </span>
  );
}

export function AdminEditableQuantity({
  orderId,
  dayOfWeek,
  optionCode,
  currentTotal,
  hasOverride,
  disabled,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentTotal);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = () => {
    setValue(currentTotal);
    setReason("");
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setReason("");
  };

  const save = () => {
    setError(null);
    if (!reason.trim()) { setError("Razón obligatoria"); return; }
    if (value === currentTotal) { setError("El total no cambió"); return; }
    startTransition(async () => {
      const res = await applyAdminOverride({ orderId, dayOfWeek, optionCode, newTotal: value, reason });
      if (!res.ok) {
        setError(res.error ?? "Error");
      } else {
        setEditing(false);
        setReason("");
        router.refresh();
      }
    });
  };

  if (disabled) {
    return (
      <span className={hasOverride ? "text-amber-700 font-semibold" : "font-semibold"}>
        {currentTotal}
        {hasOverride && <OverrideBadge />}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={open}
        className={`group inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-stone-50 transition-colors ${hasOverride ? "text-amber-700" : "text-stone-800"}`}
        title="Click para editar como admin"
      >
        <span className="font-semibold">{currentTotal}</span>
        {hasOverride && <OverrideBadge />}
        <span className="text-stone-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2 min-w-[200px] text-left">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-stone-500 whitespace-nowrap">Era {currentTotal} →</span>
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
          disabled={isPending}
          autoFocus
          className="w-16 text-sm border border-amber-300 rounded px-2 py-1 bg-white text-center"
        />
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={isPending}
        placeholder="Razón (obligatoria)"
        className="text-xs border border-amber-300 rounded px-2 py-1 bg-white"
      />
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={save}
          disabled={isPending || !reason.trim() || value === currentTotal}
          className="flex-1 text-xs px-2 py-1 rounded bg-[#D4622B] hover:bg-[#b85224] text-white disabled:opacity-50 transition-colors"
        >
          {isPending ? "…" : "Guardar"}
        </button>
        <button
          onClick={cancel}
          disabled={isPending}
          className="text-xs px-2 py-1 rounded bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
