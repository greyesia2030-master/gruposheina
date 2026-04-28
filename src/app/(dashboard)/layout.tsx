import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Defense-in-depth: block client roles from admin dashboard
  const { data: userRecord } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle();

  const role = (userRecord?.role as string | undefined) ?? "";
  if (role === "client_admin" || role === "client_user") {
    redirect("/mi-portal/pedidos");
  }
  if (["operator", "kitchen", "warehouse"].includes(role)) {
    redirect("/operador");
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
