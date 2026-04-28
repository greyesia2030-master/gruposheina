import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function MiEmpresaPage() {
  const currentUser = await requireUser();
  if (!currentUser.organizationId) return null;

  const supabase = await createSupabaseServer();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, cuit, email, contact_phone, delivery_address, cutoff_time, cutoff_days_before, departments, member_id")
    .eq("id", currentUser.organizationId)
    .single();

  if (!org) return null;

  const o = org as {
    name: string;
    cuit: string | null;
    email: string | null;
    contact_phone: string | null;
    delivery_address: string | null;
    cutoff_time: string | null;
    cutoff_days_before: number | null;
    departments: string[] | null;
    member_id: string | null;
  };

  const fields: [string, string][] = [
    ["Razón social", o.name],
    ["CUIT", o.cuit ?? "—"],
    ["Código cliente", o.member_id ?? "—"],
    ["Email de contacto", o.email ?? "—"],
    ["Teléfono", o.contact_phone ?? "—"],
    ["Dirección de entrega", o.delivery_address ?? "—"],
    ["Hora de corte", o.cutoff_time ? `${o.cutoff_time} (${o.cutoff_days_before ?? 1}d antes)` : "—"],
  ];

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Mi empresa</p>
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-8">{o.name}</h1>

      <div className="max-w-2xl space-y-4">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <dl className="divide-y divide-stone-100">
            {fields.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 py-3 text-sm sm:flex-row sm:justify-between sm:items-baseline">
                <dt className="text-stone-500">{label}</dt>
                <dd className="text-stone-900 font-medium break-all sm:text-right sm:ml-4">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {(o.departments ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">Sectores</p>
            <div className="flex flex-wrap gap-2">
              {(o.departments as string[]).map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-stone-400 italic">
          Para modificar estos datos, contactá a tu representante de Grupo Sheina.
        </p>
      </div>
    </div>
  );
}
