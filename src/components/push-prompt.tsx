"use client";

import { useState, useEffect } from "react";
import { subscribeParticipantPush } from "@/app/actions/push";

interface PushPromptProps {
  participantId: string;
}

type PromptState = "idle" | "asking" | "subscribed" | "denied" | "unsupported";

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

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
      const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPub) {
        console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurada");
        setState("denied");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPub),
      });

      const json = subscription.toJSON();
      const result = await subscribeParticipantPush({
        participantId,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      if (result.ok) {
        setState("subscribed");
      } else {
        console.error("[push] subscribeParticipantPush falló:", result.error);
        setState("denied");
      }
    } catch (err) {
      console.error("[push] handleEnable error:", err);
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
