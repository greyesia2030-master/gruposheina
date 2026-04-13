"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Algo salió mal</h2>
      <p className="max-w-md text-sm text-text-secondary">
        {error.message || "Ocurrió un error inesperado. Por favor intentá de nuevo."}
      </p>
      <Button onClick={reset}>Intentar de nuevo</Button>
    </div>
  );
}
