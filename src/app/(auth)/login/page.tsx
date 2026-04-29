"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import { IMAGES } from "@/lib/design/images";
import { fadeInUp } from "@/lib/design/motion";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials":  "Email o contraseña incorrectos.",
  "Email not confirmed":         "Debés confirmar tu email antes de ingresar.",
  "Too many requests":           "Demasiados intentos. Esperá unos minutos.",
};

function translateError(message: string): string {
  return ERROR_MESSAGES[message] ?? "Ocurrió un error. Intentá de nuevo.";
}

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E";

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

    router.push("/");
  }

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left: food hero ─────────────────────────────────────────── */}
      <div
        className="h-[42vh] lg:h-auto lg:w-[58%] flex flex-col justify-between p-8 lg:p-14 text-white relative overflow-hidden"
        style={{
          backgroundImage: `url("${IMAGES.heroLogin}")`,
          backgroundSize: "cover",
          backgroundPosition: "center 45%",
        }}
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(26,24,21,0.78) 0%, rgba(107,44,17,0.55) 55%, rgba(187,82,28,0.38) 100%)",
          }}
        />
        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.045] pointer-events-none"
          style={{ backgroundImage: `url("${GRAIN_SVG}")` }}
        />

        {/* Top brand */}
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-100/60 mb-4 font-medium">
            Grupo Sheina
          </p>
          <h1 className="font-heading text-3xl lg:text-[3.5rem] font-light leading-[1.05]">
            Cocina con propósito,
            <br />
            <em className="italic font-medium">gestión sin fricción.</em>
          </h1>
        </div>

        {/* Bottom tagline — desktop only */}
        <div className="relative z-10 hidden lg:block">
          <p className="text-sm text-white/55 leading-relaxed max-w-sm">
            Plataforma integral para gestión de viandas empresariales.
            <br />
            Desde el pedido al delivery.
          </p>
          <p className="text-[10px] text-amber-100/30 mt-5 tracking-[0.3em] uppercase">
            v2.0 · Buenos Aires
          </p>
        </div>
      </div>

      {/* ── Right: form ─────────────────────────────────────────────── */}
      <div className="flex-1 lg:w-[42%] flex items-center justify-center p-8 bg-sheina-50">
        <motion.div
          className="w-full max-w-sm"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          {/* Logo mark */}
          <div className="mb-10">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sheina-600/10 mb-5">
              <span className="text-lg font-bold text-sheina-600">S</span>
            </div>
            <h2 className="font-heading text-3xl font-light text-ink-900 mb-1">
              Ingresá
            </h2>
            <p className="text-sm text-stone-500">Sistema de gestión interno</p>
          </div>

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
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-sheina-500 focus:ring-2 focus:ring-sheina-500/15"
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
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-sheina-500 focus:ring-2 focus:ring-sheina-500/15"
              />
              {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sheina-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-sheina-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-stone-400">
            Grupo Sheina &copy; {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    </main>
  );
}
