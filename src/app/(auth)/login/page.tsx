"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

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
    <main className="min-h-screen grid lg:grid-cols-5 bg-stone-50">
      {/* Left: hero editorial */}
      <div className="lg:col-span-3 hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#D4622B] via-[#c25a26] to-[#a04a1f] text-white relative overflow-hidden">
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-100/70 mb-3">
            Sistema de gestión
          </p>
          <h1 className="font-heading text-6xl font-light leading-[1.05]">
            Grupo<br />
            <em className="italic font-medium">Sheina</em>.
          </h1>
        </div>

        <blockquote className="relative z-10 max-w-md">
          <p className="font-heading italic text-2xl leading-snug text-white/90">
            &ldquo;La calidad de cada vianda comienza con la trazabilidad de cada insumo.&rdquo;
          </p>
          <footer className="text-sm text-amber-100/70 mt-4 tracking-wide not-italic">
            — Política de calidad
          </footer>
        </blockquote>
      </div>

      {/* Right: form */}
      <div className="lg:col-span-2 flex items-center justify-center p-8 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4622B]/10 mb-3">
              <span className="text-xl font-bold text-[#D4622B]">S</span>
            </div>
            <p className="text-sm font-medium text-stone-600">Grupo Sheina</p>
          </div>

          <h2 className="font-heading text-3xl font-light text-stone-900 mb-1">Ingresá</h2>
          <p className="text-sm text-stone-500 mb-8">Sistema de gestión interno</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sheina.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-[#D4622B] focus:ring-2 focus:ring-[#D4622B]/15"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-[#D4622B] focus:ring-2 focus:ring-[#D4622B]/15"
              />
              {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#D4622B] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#b85224] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-stone-400">
            Grupo Sheina &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}
