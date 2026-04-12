"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createBrowserClient } from "@/lib/supabase/client";

const movementSchema = z.object({
  type:     z.string().min(1),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unitCost: z.coerce.number().min(0, "El costo no puede ser negativo"),
  reason:   z.string().max(300),
});

const MOVEMENT_OPTIONS = [
  { value: "purchase", label: "Compra" },
  { value: "waste", label: "Merma" },
  { value: "adjustment_pos", label: "Ajuste positivo" },
  { value: "adjustment_neg", label: "Ajuste negativo" },
  { value: "return", label: "Devolución" },
];

const POSITIVE_TYPES = ["purchase", "adjustment_pos", "return"];

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
  const supabase = createBrowserClient();

  const needsReason = type.startsWith("adjustment");

  async function handleRegister() {
    const parsed = movementSchema.safeParse({
      type, quantity, unitCost, reason,
    });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Datos inválidos", "error");
      return;
    }

    if (needsReason && !reason.trim()) {
      toast("El motivo es obligatorio para ajustes", "error");
      return;
    }

    const qty = parsed.data.quantity;
    setLoading(true);
    try {
      // Resolver actor_id desde users
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let actorId: string | null = null;
      if (authUser) {
        const { data: userRecord } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", authUser.id)
          .single();
        actorId = userRecord?.id ?? null;
      }

      // Obtener stock actual
      const { data: itemData } = await supabase
        .from("inventory_items")
        .select("current_stock")
        .eq("id", itemId)
        .single();

      const item = itemData as { current_stock: number } | null;
      if (!item) throw new Error("Insumo no encontrado");

      const isPositive = POSITIVE_TYPES.includes(type);
      const newStock = isPositive
        ? item.current_stock + qty
        : item.current_stock - qty;

      // Actualizar stock
      await supabase
        .from("inventory_items")
        .update({ current_stock: newStock })
        .eq("id", itemId);

      // Registrar movimiento
      await supabase.from("inventory_movements").insert({
        item_id: itemId,
        movement_type: type,
        quantity: isPositive ? qty : -qty,
        unit_cost: parseFloat(unitCost) || 0,
        reason: reason.trim() || null,
        actor_id: actorId,
        stock_after: newStock,
      });

      toast("Movimiento registrado", "success");
      setQuantity("");
      setReason("");
      router.refresh();
    } catch {
      toast("Error al registrar movimiento", "error");
    } finally {
      setLoading(false);
    }
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
