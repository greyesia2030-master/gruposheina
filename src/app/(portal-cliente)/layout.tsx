import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { ShoppingBag, LayoutDashboard, LogOut } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";

async function SignOutButton() {
  return (
    <form action="/api/auth/signout" method="post">
      <button
        type="submit"
        className="flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors w-full"
      >
        <LogOut className="h-4 w-4" />
        Salir
      </button>
    </form>
  );
}

export default async function PortalClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch {
    redirect("/login");
  }

  if (currentUser.role !== "client_admin" && currentUser.role !== "client_user") {
    redirect("/pedidos");
  }

  return (
    <div className="flex h-screen bg-stone-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-5 py-5 border-b border-stone-100">
          <p className="font-heading text-lg font-medium text-stone-900">Mi Portal</p>
          <p className="text-xs text-stone-400 mt-0.5 truncate">{currentUser.fullName ?? "—"}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/mi-portal"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-stone-400" />
            Inicio
          </Link>
          <Link
            href="/mi-portal/pedidos"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <ShoppingBag className="h-4 w-4 text-stone-400" />
            Mis pedidos
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-stone-100">
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
