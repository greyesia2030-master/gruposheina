"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, BookOpen, Building2 } from "lucide-react";

const NAV = [
  { label: "Mis pedidos", href: "/mi-portal/pedidos", icon: ShoppingBag },
  { label: "Menú activo", href: "/mi-portal/menu", icon: BookOpen },
  { label: "Mi empresa", href: "/mi-portal/empresa", icon: Building2 },
];

export function PortalNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              active
                ? "bg-[#D4622B]/10 text-[#D4622B]"
                : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
