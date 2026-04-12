"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Bell, User } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

export function Header() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("full_name, role")
        .eq("auth_id", user.id)
        .single();

      if (profile) setUserName(profile.full_name);
      else setUserName(user.email ?? "Usuario");
    }

    async function loadPendingOrders() {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft");

      setPendingCount(count ?? 0);
    }

    loadUser();
    loadPendingOrders();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      {/* Spacer para mobile (el hamburger está fixed) */}
      <div className="w-8 lg:hidden" />

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* Notificaciones */}
        <button
          className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
          title={`${pendingCount} pedidos pendientes`}
        >
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>

        {/* Usuario */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden font-medium sm:inline">{userName ?? "Cargando..."}</span>
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-error transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
