"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Bell, User, CheckCircle, ShoppingBag, AlertTriangle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

type NotificationType = "order_created" | "order_confirmed" | "low_stock";

interface Notification {
  id: string;
  type: NotificationType;
  label: string;
  sublabel: string;
  href: string;
  createdAt: string;
}

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  order_created: <ShoppingBag className="h-4 w-4 text-primary" />,
  order_confirmed: <CheckCircle className="h-4 w-4 text-green-600" />,
  low_stock: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

const TYPE_LABEL: Record<NotificationType, string> = {
  order_created: "Nuevo pedido",
  order_confirmed: "Pedido confirmado",
  low_stock: "Stock bajo",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

export function Header() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

  const loadNotifications = useCallback(async () => {
    // Recent order events: created + confirmed
    const { data: events } = await supabase
      .from("order_events")
      .select("id, event_type, order_id, created_at, order:orders(week_label, organization:organizations(name))")
      .in("event_type", ["created", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(5);

    const orderNotifs: Notification[] = (events ?? []).map((e) => {
      const order = e.order as unknown as { week_label: string; organization: { name: string } | null } | null;
      const orgName = order?.organization?.name ?? "—";
      const week = order?.week_label ?? "—";
      const type: NotificationType = e.event_type === "created" ? "order_created" : "order_confirmed";
      return {
        id: `evt-${e.id}`,
        type,
        label: `${orgName} — ${week}`,
        sublabel: TYPE_LABEL[type],
        href: `/pedidos/${e.order_id}`,
        createdAt: e.created_at,
      };
    });

    // Low stock alerts — fetch and filter client-side (inventory table is small)
    const { data: allItems } = await supabase
      .from("inventory_items")
      .select("id, name, current_stock, min_stock, unit, updated_at")
      .eq("is_active", true)
      .order("current_stock", { ascending: true })
      .limit(50);

    const stockNotifs: Notification[] = (allItems ?? [])
      .filter((item) => item.current_stock <= item.min_stock)
      .slice(0, 3)
      .map((item) => ({
        id: `inv-${item.id}`,
        type: "low_stock" as const,
        label: item.name,
        sublabel: `Stock: ${item.current_stock} ${item.unit} (mín: ${item.min_stock})`,
        href: `/inventario/${item.id}`,
        createdAt: item.updated_at,
      }));

    // Merge and sort by date, keep top 5
    const all = [...orderNotifs, ...stockNotifs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    setNotifications(all);
    // Update badge: pending drafts + low stock count
    const lowStockCount = stockNotifs.length;
    const { count: drafts } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft");
    setPendingCount((drafts ?? 0) + lowStockCount);
  }, [supabase]);

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

    loadUser();
    loadNotifications();
  }, [supabase, loadNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setDropdownOpen((prev) => !prev);
              if (!dropdownOpen) loadNotifications();
            }}
            className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
            title={`${pendingCount} notificaciones`}
          >
            <Bell className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-text">Notificaciones</p>
              </div>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-text-secondary">
                  <Bell className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Sin notificaciones pendientes</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                          {TYPE_ICON[n.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">{n.label}</p>
                          <p className="text-xs text-text-secondary">{n.sublabel}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-text-secondary">
                          {timeAgo(n.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-border px-4 py-2">
                <Link
                  href="/pedidos?status=draft"
                  onClick={() => setDropdownOpen(false)}
                  className="block text-center text-xs font-medium text-primary hover:underline py-1"
                >
                  Ver todos los pedidos pendientes
                </Link>
              </div>
            </div>
          )}
        </div>

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
