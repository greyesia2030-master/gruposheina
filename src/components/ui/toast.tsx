"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-success/30 bg-green-50",
  error:   "border-error/30 bg-red-50",
  warning: "border-warning/30 bg-amber-50",
  info:    "border-info/30 bg-blue-50",
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 shrink-0 text-success" />,
  error:   <AlertCircle className="h-5 w-5 shrink-0 text-error" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />,
  info:    <Info className="h-5 w-5 shrink-0 text-info" />,
};

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${TOAST_STYLES[t.type]}`}
          >
            {ICONS[t.type]}
            <span className="flex-1 text-sm text-text">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-1 shrink-0 rounded p-0.5 text-text-secondary hover:bg-black/10 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
