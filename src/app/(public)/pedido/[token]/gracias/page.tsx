"use client";

import { useSearchParams } from "next/navigation";
import { PushPrompt } from "@/components/push-prompt";

export default function GraciasPage() {
  const searchParams = useSearchParams();
  const participantId = searchParams.get("pid");

  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center">
      <div className="text-6xl mb-5">✅</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">¡Gracias!</h1>
      <p className="text-gray-600 mb-2">Tu aporte fue registrado correctamente.</p>
      <p className="text-gray-500 text-sm mb-8">
        El equipo de Sheina ya tiene tu selección.
      </p>

      {participantId && <PushPrompt participantId={participantId} />}

      <div className="mt-6 bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-600">
        Podés cerrar esta pestaña. No es necesario hacer nada más.
      </div>
    </div>
  );
}
