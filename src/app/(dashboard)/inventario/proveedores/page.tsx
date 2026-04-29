export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierForm, ToggleSupplierButton } from "./SupplierForm";
import type { Supplier } from "@/lib/types/database";

const ALLOWED_ROLES = ["superadmin", "admin"];

export default async function InventarioProveedoresPage() {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) redirect("/");

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("suppliers")
    .select("id, organization_id, name, cuit, contact_name, contact_phone, contact_email, payment_terms, is_active, notes, created_at, updated_at")
    .order("name");

  const suppliers = (data ?? []) as Supplier[];

  return (
    <div>
      <PageHeader
        title="Proveedores"
        breadcrumbs={[
          { label: "Inventario", href: "/inventario" },
          { label: "Proveedores" },
        ]}
        action={<SupplierForm />}
      />

      {suppliers.length === 0 ? (
        <Card><p className="p-8 text-center text-text-secondary">Sin proveedores registrados.</p></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">CUIT</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div>{s.contact_name ?? "—"}</div>
                        {s.contact_phone && <div className="text-xs">{s.contact_phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{s.cuit ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={s.is_active ? "success" : "default"}>
                          {s.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <SupplierForm supplier={s} />
                          <ToggleSupplierButton id={s.id} isActive={s.is_active} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="md:hidden space-y-3">
            {suppliers.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium">{s.name}</p>
                  <Badge variant={s.is_active ? "success" : "default"}>
                    {s.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                {s.contact_name && <p className="text-xs text-text-secondary">{s.contact_name}</p>}
                {s.contact_phone && <p className="text-xs text-text-secondary mb-3">{s.contact_phone}</p>}
                <div className="flex gap-2">
                  <SupplierForm supplier={s} />
                  <ToggleSupplierButton id={s.id} isActive={s.is_active} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
