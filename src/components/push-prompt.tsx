"use client";

import { useState, useEffect } from "react";
import { subscribeParticipantPush } from "@/app/actions/push";

interface PushPromptProps {
  participantId: string;
}

type PromptState = "idle" | "asking" | "subscribed" | "denied" | "unsupported";

export function PushPrompt({ participantId }: PushPromptProps) {
  const [state, setState] = useState<PromptState>("idle");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setState("subscribed");
    } else if (Notification.permission === "denied") {
      setState("denied");
    }
  }, []);

  const handleEnable = async () => {
    setState("asking");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      const json = subscription.toJSON();
      const result = await subscribeParticipantPush({
        participantId,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        userAgent: navigator.userAgent,
      });
      setState(result.ok ? "subscribed" : "denied");
    } catch {
      setState("denied");
    }
  };

  if (state === "unsupported" || state === "subscribed" || state === "denied") {
    return null;
  }

  return (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
      <p className="text-sm font-medium text-gray-800 mb-1">
        ¿Querés recibir una notificación cuando el pedido esté listo?
      </p>
      <p className="text-xs text-gray-500 mb-3">
        Te avisamos cuando todas las secciones estén cerradas y el pedido confirmado.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleEnable}
          disabled={state === "asking"}
          className="flex-1 bg-[#D4622B] hover:bg-[#b85224] disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {state === "asking" ? "Activando…" : "Activar notificaciones"}
        </button>
      </div>
    </div>
  );
}
