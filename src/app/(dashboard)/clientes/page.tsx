export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types/database";

const STATUS_VARIANT: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  suspended: "warning",
  inactive: "default",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  inactive: "Inactivo",
};

export default async function ClientesPage() {
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("organizations")
    .select("*")
    .order("name");
  const orgs = (data ?? []) as Organization[];

  return (
    <div>
      <PageHeader title="Clientes" />

      {orgs && orgs.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">CUIT</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Corte</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3">{org.cuit ?? "—"}</td>
                    <td className="px-4 py-3">{org.contact_phone ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {org.cutoff_time} ({org.cutoff_days_before}d antes)
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[org.status] ?? "default"}>
                        {STATUS_LABELS[org.status] ?? org.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="p-8 text-center text-text-secondary">No hay organizaciones registradas</p>
        </Card>
      )}
    </div>
  );
}
