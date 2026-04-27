"use client";

import { useEffect } from "react";

export default function InventarioDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[inventario/[id]]", error);
  }, [error]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-red-900">Error al cargar inventario</h2>
        <p className="text-sm text-red-800">{error.message || "Error desconocido"}</p>
        {error.digest && (
          <p className="text-xs text-red-700 font-mono">digest: {error.digest}</p>
        )}
        {process.env.NODE_ENV !== "production" && error.stack && (
          <pre className="text-xs bg-red-100 p-3 rounded overflow-x-auto">{error.stack}</pre>
        )}
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#D4622B] hover:bg-[#b85224] text-white"
          >
            Reintentar
          </button>
          <a
            href="/inventario"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-stone-300 text-stone-700"
          >
            Volver a inventario
          </a>
        </div>
      </div>
    </div>
  );
}
