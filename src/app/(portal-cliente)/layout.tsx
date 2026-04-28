import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { PortalNavLinks } from "./portal-nav";
import { RoleGuard } from "@/components/auth/role-guard";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CLIENT_ROLES = ["client_admin", "client_user"];
const QA_ROLES = ["superadmin", "admin"];

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
      <RoleGuard allowed={["client_admin", "client_user", "superadmin", "admin"]} />
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
