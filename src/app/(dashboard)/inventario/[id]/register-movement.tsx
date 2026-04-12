"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { registerMovement } from "@/app/actions/inventory";

const MOVEMENT_OPTIONS = [
  { value: "purchase", label: "Compra" },
  { value: "waste", label: "Merma" },
  { value: "adjustment_pos", label: "Ajuste positivo" },
  { value: "adjustment_neg", label: "Ajuste negativo" },
  { value: "return", label: "Devolución" },
];

interface RegisterMovementProps {
  itemId: string;
  currentCostPerUnit: number;
}

export function RegisterMovement({ itemId, currentCostPerUnit }: RegisterMovementProps) {
  const [type, setType] = useState("purchase");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(String(currentCostPerUnit));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const needsReason = type.startsWith("adjustment");

  async function handleRegister() {
    setLoading(true);
    const result = await registerMovement({
      itemId,
      movementType: type as
        | "purchase"
        | "production_consumption"
        | "waste"
        | "adjustment_pos"
        | "adjustment_neg"
        | "return",
      quantity,
      unitCost,
      reason,
    });
    setLoading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast("Movimiento registrado", "success");
    setQuantity("");
    setReason("");
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Registrar movimiento</h2>
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-5">
          <Select
            label="Tipo"
            options={MOVEMENT_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <Input
            label="Cantidad"
            type="number"
            step="0.01"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="Costo unitario ($)"
            type="number"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label={needsReason ? "Motivo *" : "Motivo"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={needsReason ? "Obligatorio para ajustes" : "Opcional"}
            />
          </div>
        </div>
        <div className="border-t border-border p-3 flex justify-end">
          <Button onClick={handleRegister} loading={loading} size="sm">
            Registrar movimiento
          </Button>
        </div>
      </Card>
    </div>
  );
}
