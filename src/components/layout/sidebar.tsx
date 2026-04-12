"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  BookOpen,
  Package,
  Building2,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/menus", label: "Menús", icon: UtensilsCrossed },
  { href: "/recetas", label: "Recetas", icon: BookOpen },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/clientes", label: "Clientes", icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navContent = (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-l-3 border-primary bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-surface-hover hover:text-text"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-surface p-2 shadow-md lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-surface border-r border-border transition-transform lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <span className="text-lg font-bold text-primary">Grupo Sheina</span>
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="border-b border-border px-6 py-5">
          <span className="text-lg font-bold text-primary">Grupo Sheina</span>
          <p className="text-xs text-text-secondary mt-0.5">Gestión de Viandas</p>
        </div>
        {navContent}
      </aside>
    </>
  );
}
