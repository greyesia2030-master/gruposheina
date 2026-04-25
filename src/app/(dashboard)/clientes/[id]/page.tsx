export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { canManageClients } from "@/lib/permissions";
import { formatART } from "@/lib/utils/timezone";
import { AddAuthorizedPhone } from "./add-authorized-phone";
import { RemoveAuthorizedPhone } from "./remove-authorized-phone";
import { EditOrgForm } from "./edit-org-form";
import { AddUserButton } from "./add-user-button";
import { DeactivateButton } from "./deactivate-button";
import type { OrderStatus, Organization } from "@/lib/types/database";
import { MessageSquare, Users, Phone, Building2, Clock, ShoppingBag } from "lucide-react";

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

export default async function ClienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab = "info" }, supabase, currentUser] = await Promise.all([
    params,
    searchParams,
    createSupabaseServer(),
    requireUser(),
  ]);

  const canManage = canManageClients(currentUser.role);

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) notFound();

  // Carga paralela según tab activo
  const [usersResult, ordersResult] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, phone, role, is_active, created_at")
      .eq("organization_id", id)
      .order("full_name"),
    supabase
      .from("orders")
      .select("id, week_label, status, total_units, source, created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const users = usersResult.data ?? [];
  const orders = ordersResult.data ?? [];

  const TABS = [
    { key: "info",      label: "Información",            icon: <Building2 className="h-4 w-4" /> },
    { key: "phones",    label: `Teléfonos (${(org.authorized_phones ?? []).length})`, icon: <Phone className="h-4 w-4" /> },
    { key: "users",     label: `Usuarios (${users.length})`,   icon: <Users className="h-4 w-4" /> },
    { key: "orders",    label: `Pedidos (${orders.length})`,   icon: <ShoppingBag className="h-4 w-4" /> },
    { key: "convs",     label: "Conversaciones",          icon: <MessageSquare className="h-4 w-4" /> },
  ];

  return (
    <div>
      <PageHeader
        title={org.name}
        breadcrumbs={[
          { label: "Clientes", href: "/clientes" },
          { label: org.name },
        ]}
        action={
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[org.status] ?? "default"}>
              {STATUS_LABELS[org.status] ?? org.status}
            </Badge>
            {canManage && (
              <Link
                href={`/clientes/${id}/departamentos`}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Departamentos
              </Link>
            )}
            {canManage && (
              <Link
                href={`/clientes/${id}/configuracion`}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Configuración
              </Link>
            )}
            {canManage && org.status !== "inactive" && (
              <DeactivateButton orgId={id} />
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clientes/${id}?tab=${t.key}`}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── TAB: Información ── */}
      {tab === "info" && (
        <div className="space-y-4">
          <Card>
            <div className="p-4">
              {canManage ? (
                <EditOrgForm org={org as Organization} />
              ) : (
                <div className="divide-y divide-border">
                  {[
                    ["Nombre",    org.name],
                    ["CUIT",      org.cuit ?? "—"],
                    ["Teléfono",  org.contact_phone ?? "—"],
                    ["Email",     org.email ?? "—"],
                    ["Dirección", org.delivery_address ?? "—"],
                    ["Precio/vianda", `$${org.price_per_unit}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between px-0 py-3 text-sm">
                      <span className="text-text-secondary">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div className="divide-y divide-border">
              <div className="flex items-center gap-2 px-4 py-3">
                <Clock className="h-4 w-4 text-text-secondary" />
                <span className="text-sm text-text-secondary">Departamentos</span>
              </div>
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(org.departments ?? []).map((d: string) => (
                    <Badge key={d} variant="info">{d}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: Teléfonos autorizados ── */}
      {tab === "phones" && (
        <div className="space-y-4">
          <Card>
            <div className="p-4">
              <p className="mb-3 text-sm text-text-secondary">
                Si la lista está vacía, cualquier teléfono vinculado al cliente puede enviar pedidos.
                Al agregar al menos uno, solo esos números tendrán acceso.
              </p>
              {(org.authorized_phones ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">Sin restricción de teléfonos</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(org.authorized_phones as string[]).map((phone) => (
                    <li key={phone} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-mono">{phone}</span>
                      {canManage && (
                        <RemoveAuthorizedPhone orgId={id} phone={phone} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          {canManage && <AddAuthorizedPhone orgId={id} />}
        </div>
      )}

      {/* ── TAB: Usuarios ── */}
      {tab === "users" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <AddUserButton orgId={id} />
            </div>
          )}
        <Card>
          {users.length === 0 ? (
            <p className="p-8 text-center text-text-secondary">Sin usuarios vinculados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Teléfono</th>
                    <th className="px-4 py-3 font-medium">Rol</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{u.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{u.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{u.role}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.is_active ? "success" : "default"}>
                          {u.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>
      )}

      {/* ── TAB: Pedidos ── */}
      {tab === "orders" && (
        <Card>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-text-secondary">Sin pedidos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Semana</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Viandas</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <Link href={`/pedidos/${o.id}`} className="font-medium hover:text-primary">
                          {o.week_label}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status as OrderStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{o.total_units}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatART(o.created_at, "dd/MM/yy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: Conversaciones ── */}
      {tab === "convs" && (
        <Card>
          <div className="p-6 text-center">
            <MessageSquare className="mx-auto mb-3 h-8 w-8 text-text-secondary" />
            <p className="mb-4 text-text-secondary">Historial completo de conversaciones WhatsApp</p>
            <Link
              href={`/clientes/${id}/conversaciones`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <MessageSquare className="h-4 w-4" />
              Ver conversaciones
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
