"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderCutoff } from "@/app/actions/orders";
import { useToast } from "@/components/ui/toast";
import { Pencil, Check, X } from "lucide-react";

interface CutoffEditorProps {
  orderId: string;
  currentCutoffIso: string | null;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  // datetime-local requires "YYYY-MM-DDTHH:MM" without timezone
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function CutoffEditor({ orderId, currentCutoffIso }: CutoffEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(isoToLocalInput(currentCutoffIso));
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!value) return;
    const isoValue = new Date(value).toISOString();
    startTransition(async () => {
      const result = await setOrderCutoff({ orderId, cutoffAt: isoValue });
      if (result.ok) {
        toast("Corte actualizado", "success");
        setEditing(false);
        router.refresh();
      } else {
        toast(result.error || "Error al guardar", "error");
      }
    });
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors"
        title="Editar corte"
      >
        <Pencil className="h-3 w-3" />
        Editar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs border border-border rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={handleSave}
        disabled={isPending || !value}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <Check className="h-3 w-3" />
        {isPending ? "Guardando…" : "Guardar"}
      </button>
      <button
        onClick={() => { setEditing(false); setValue(isoToLocalInput(currentCutoffIso)); }}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border hover:bg-surface-hover transition-colors"
      >
        <X className="h-3 w-3" />
        Cancelar
      </button>
    </div>
  );
}
