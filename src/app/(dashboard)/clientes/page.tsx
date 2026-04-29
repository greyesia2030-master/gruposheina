export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types/database";
import { NewClientButton } from "./new-client-button";
import { ClickableRow } from "./clickable-row";

const STATUS_VARIANT: Record<string, "success" | "warning" | "default"> = {
  active:    "success",
  suspended: "warning",
  inactive:  "default",
};

const STATUS_LABELS: Record<string, string> = {
  active:    "Activo",
  suspended: "Suspendido",
  inactive:  "Inactivo",
};

export default async function ClientesPage() {
  const supabase = await createSupabaseServer();

  const [{ data }, ordersResult] = await Promise.all([
    supabase.from("organizations").select("*").order("name"),
    supabase
      .from("orders")
      .select("organization_id")
      .not("status", "in", "(delivered,cancelled)"),
  ]);

  const orgs = (data ?? []) as Organization[];

  // Contar pedidos activos por organización
  const activeOrderCount: Record<string, number> = {};
  for (const o of ordersResult.data ?? []) {
    activeOrderCount[o.organization_id] = (activeOrderCount[o.organization_id] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader title="Clientes" action={<NewClientButton />} />

      {orgs && orgs.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">CUIT</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Corte</th>
                  <th className="px-4 py-3 text-center">Pedidos activos</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => {
                  const count = activeOrderCount[org.id] ?? 0;
                  return (
                    <ClickableRow key={org.id} href={`/clientes/${org.id}`} className="border-b border-stone-100 last:border-0 hover:bg-sheina-50/40 transition-colors">
                      <td className="px-4 py-3 font-medium">{org.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{org.cuit ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{org.contact_phone ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {org.cutoff_time} ({org.cutoff_days_before}d antes)
                      </td>
                      <td className="px-4 py-3 text-center">
                        {count > 0 ? (
                          <Badge variant="primary">{count}</Badge>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[org.status] ?? "default"}>
                          {STATUS_LABELS[org.status] ?? org.status}
                        </Badge>
                      </td>
                    </ClickableRow>
                  );
                })}
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
