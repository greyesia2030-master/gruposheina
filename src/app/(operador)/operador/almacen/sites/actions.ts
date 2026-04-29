"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = ["warehouse", "admin", "superadmin"];
const REVALIDATE = "/operador/almacen/sites";

function fail(error: string) { return { ok: false as const, error }; }
function okVoid() { return { ok: true as const }; }

const siteSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  site_type: z.enum(["warehouse", "kitchen", "delivery_point", "distribution_hub"]),
  address: z.string().trim().nullable().optional(),
  contact_phone: z.string().trim().nullable().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
});

type SiteInput = z.input<typeof siteSchema>;

export async function createSite(input: SiteInput) {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) return fail("Sin permisos");
  if (!user.organizationId) return fail("Sin organización asignada");

  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const db = await createSupabaseAdmin();
  const { data, error } = await db
    .from("sites")
    .insert({ ...parsed.data, organization_id: user.organizationId })
    .select("id")
    .single();

  if (error || !data) return fail(error?.message ?? "Error al crear sitio");

  revalidatePath(REVALIDATE);
  return { ok: true as const, data: { id: data.id } };
}

export async function updateSite(id: string, input: SiteInput) {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) return fail("Sin permisos");

  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const db = await createSupabaseAdmin();
  const { error } = await db.from("sites").update(parsed.data).eq("id", id);

  if (error) return fail(error.message);
  revalidatePath(REVALIDATE);
  return okVoid();
}

export async function toggleSiteActive(id: string, next: boolean) {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) return fail("Sin permisos");

  const db = await createSupabaseAdmin();
  const { error } = await db.from("sites").update({ is_active: next }).eq("id", id);

  if (error) return fail(error.message);
  revalidatePath(REVALIDATE);
  return okVoid();
}
