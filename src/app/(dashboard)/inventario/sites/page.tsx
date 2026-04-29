export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteForm, ToggleSiteButton } from "@/app/(operador)/operador/almacen/sites/SiteForm";
import type { Site } from "@/lib/types/database";

const ALLOWED_ROLES = ["superadmin", "admin"];

const SITE_TYPE_LABELS: Record<string, string> = {
  warehouse: "Almacén",
  kitchen: "Cocina",
  delivery_point: "Punto de entrega",
  distribution_hub: "Hub de distribución",
};

export default async function InventarioSitesPage() {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) redirect("/");

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("sites")
    .select("id, organization_id, name, site_type, address, latitude, longitude, contact_phone, is_active, created_at, updated_at")
    .order("name");

  const sites = (data ?? []) as Site[];

  return (
    <div>
      <PageHeader
        title="Sitios"
        breadcrumbs={[
          { label: "Inventario", href: "/inventario" },
          { label: "Sitios" },
        ]}
        action={<SiteForm />}
      />

      {sites.length === 0 ? (
        <Card><p className="p-8 text-center text-text-secondary">Sin sitios registrados.</p></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Dirección</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium">{site.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{SITE_TYPE_LABELS[site.site_type] ?? site.site_type}</td>
                      <td className="px-4 py-3 text-text-secondary">{site.address ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={site.is_active ? "success" : "default"}>
                          {site.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <SiteForm site={site} />
                          <ToggleSiteButton id={site.id} isActive={site.is_active} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="md:hidden space-y-3">
            {sites.map((site) => (
              <Card key={site.id} className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium">{site.name}</p>
                  <Badge variant={site.is_active ? "success" : "default"}>
                    {site.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary mb-1">{SITE_TYPE_LABELS[site.site_type] ?? site.site_type}</p>
                {site.address && <p className="text-xs text-text-secondary mb-3">{site.address}</p>}
                <div className="flex gap-2">
                  <SiteForm site={site} />
                  <ToggleSiteButton id={site.id} isActive={site.is_active} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
