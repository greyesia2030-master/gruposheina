import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteForm, ToggleSiteButton } from "./SiteForm";
import type { Site } from "@/lib/types/database";

const ALLOWED_ROLES = ["warehouse", "admin", "superadmin"];

const SITE_TYPE_LABELS: Record<string, string> = {
  warehouse: "Almacén",
  kitchen: "Cocina",
  delivery_point: "Punto de entrega",
  distribution_hub: "Hub de distribución",
};

export default async function SitesPage() {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) redirect("/operador");

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("sites")
    .select("id, organization_id, name, site_type, address, latitude, longitude, contact_phone, is_active, created_at, updated_at")
    .order("name");

  const sites = (data ?? []) as Site[];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-light text-stone-900 mb-1">Sitios</h1>
          <p className="text-sm text-stone-400">Cocinas y depósitos de la organización.</p>
        </div>
        <SiteForm />
      </div>

      {sites.length === 0 ? (
        <Card className="p-8 text-center text-sm text-stone-400">Sin sitios registrados.</Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Dirección</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-900">{site.name}</td>
                      <td className="px-4 py-3 text-stone-500">{SITE_TYPE_LABELS[site.site_type] ?? site.site_type}</td>
                      <td className="px-4 py-3 text-stone-500">{site.address ?? "—"}</td>
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

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {sites.map((site) => (
              <Card key={site.id} className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium text-stone-900">{site.name}</p>
                  <Badge variant={site.is_active ? "success" : "default"}>
                    {site.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <p className="text-xs text-stone-400 mb-1">{SITE_TYPE_LABELS[site.site_type] ?? site.site_type}</p>
                {site.address && <p className="text-xs text-stone-400 mb-3">{site.address}</p>}
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
