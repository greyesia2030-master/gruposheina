"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials":  "Email o contraseña incorrectos.",
  "Email not confirmed":         "Debés confirmar tu email antes de ingresar.",
  "Too many requests":           "Demasiados intentos. Esperá unos minutos.",
};

function translateError(message: string): string {
  return ERROR_MESSAGES[message] ?? "Ocurrió un error. Intentá de nuevo.";
}

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const router   = useRouter();
  const supabase = createBrowserClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
      return;
    }

    router.push("/pedidos");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
      {/* Encabezado */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <span className="text-xl font-bold text-primary">S</span>
        </div>
        <h1 className="text-2xl font-bold text-primary">Grupo Sheina</h1>
        <p className="mt-1 text-sm text-text-secondary">Sistema de Gestión de Viandas</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@sheina.com"
          required
          autoComplete="email"
        />

        <Input
          id="password"
          type="password"
          label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          error={error ?? undefined}
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Ingresar
        </Button>
      </form>
    </div>
  );
}
