export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { ChefHat, Package, LayoutDashboard } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { SignOutButton } from "@/components/auth/sign-out-button";

const OPERATOR_ROLES = ["operator", "kitchen", "warehouse", "superadmin", "admin"];

export default async function OperadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let currentUser;
  try {
    currentUser = await requireUser();
  } catch {
    redirect("/login");
  }

  if (!OPERATOR_ROLES.includes(currentUser.role)) {
    redirect("/mi-portal");
  }

  return (
    <div className="flex h-screen bg-stone-50">
      <RoleGuard allowed={["operator", "kitchen", "warehouse", "superadmin", "admin"]} />
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-5 py-5 border-b border-stone-100">
          <p className="font-heading text-lg font-medium text-stone-900">Operaciones</p>
          <p className="text-xs text-stone-400 mt-0.5 truncate">{currentUser.fullName ?? "—"}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/operador"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-stone-400" />
            Dashboard
          </Link>
          <Link
            href="/operador/produccion"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <ChefHat className="h-4 w-4 text-stone-400" />
            Producción
          </Link>
          <Link
            href="/operador/inventario"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <Package className="h-4 w-4 text-stone-400" />
            Inventario
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-stone-100">
          <Link
            href="/pedidos"
            className="flex items-center gap-2 px-3 py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors mb-1"
          >
            ← Panel completo
          </Link>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
