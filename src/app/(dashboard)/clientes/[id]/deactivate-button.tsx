"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deactivateOrganizationAction } from "../actions";

export function DeactivateButton({ orgId }: { orgId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deactivateOrganizationAction(orgId);
      if (!result.ok) {
        toast(result.error, "error");
      } else {
        toast("Cliente desactivado", "success");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">¿Confirmar desactivación?</span>
        <Button size="sm" variant="danger" onClick={handleConfirm} loading={isPending}>
          Sí, desactivar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      Desactivar cliente
    </Button>
  );
}
