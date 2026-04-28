import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { LogOut } from "lucide-react";
import { PortalNavLinks } from "./portal-nav";

const CLIENT_ROLES = ["client_admin", "client_user"];
const QA_ROLES = ["superadmin", "admin"];

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
  let currentUser;
  try {
    currentUser = await requireUser();
  } catch {
    redirect("/login");
  }

  // Allow client roles + superadmin/admin for QA inspection
  if (!CLIENT_ROLES.includes(currentUser.role) && !QA_ROLES.includes(currentUser.role)) {
    redirect("/pedidos");
  }

  return (
    <div className="flex h-screen bg-stone-50">
      <aside className="w-56 shrink-0 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-5 py-5 border-b border-stone-100">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Portal cliente</p>
          <p className="font-heading text-base font-medium text-stone-900 leading-tight truncate">
            {currentUser.fullName ?? "—"}
          </p>
        </div>

        <PortalNavLinks />

        <div className="px-3 py-4 border-t border-stone-100">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
