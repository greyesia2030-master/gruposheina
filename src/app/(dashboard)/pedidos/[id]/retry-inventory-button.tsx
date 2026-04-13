"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { retryInventoryConsumption } from "@/app/actions/orders";
import { RefreshCw } from "lucide-react";

interface RetryInventoryButtonProps {
  orderId: string;
}

export function RetryInventoryButton({ orderId }: RetryInventoryButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleRetry() {
    setLoading(true);
    const result = await retryInventoryConsumption(orderId);
    setLoading(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Inventario recalculado — ${result.consumed} movimientos creados`, "success");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={handleRetry}
      title="Consumir insumos del inventario según las recetas del pedido"
    >
      <RefreshCw className="h-4 w-4" />
      Recalcular inventario
    </Button>
  );
}
