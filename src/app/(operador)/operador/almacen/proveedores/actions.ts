"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

const ALLOWED_ROLES = ["warehouse", "admin", "superadmin"];
const REVALIDATE = "/operador/almacen/proveedores";

function fail(error: string) { return { ok: false as const, error }; }
function okVoid() { return { ok: true as const }; }

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  cuit: z.string().trim().nullable().optional(),
  contact_name: z.string().trim().nullable().optional(),
  contact_phone: z.string().trim().nullable().optional(),
  contact_email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
  payment_terms: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

type SupplierInput = z.input<typeof supplierSchema>;

export async function createSupplier(input: SupplierInput) {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) return fail("Sin permisos");
  if (!user.organizationId) return fail("Sin organización asignada");

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const d = parsed.data;
  const db = await createSupabaseAdmin();
  const { data, error } = await db
    .from("suppliers")
    .insert({
      ...d,
      contact_email: d.contact_email || null,
      organization_id: user.organizationId,
    })
    .select("id")
    .single();

  if (error || !data) return fail(error?.message ?? "Error al crear proveedor");

  revalidatePath(REVALIDATE);
  return { ok: true as const, data: { id: data.id } };
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) return fail("Sin permisos");

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const d = parsed.data;
  const db = await createSupabaseAdmin();
  const { error } = await db
    .from("suppliers")
    .update({ ...d, contact_email: d.contact_email || null })
    .eq("id", id);

  if (error) return fail(error.message);
  revalidatePath(REVALIDATE);
  return okVoid();
}

export async function toggleSupplierActive(id: string, next: boolean) {
  const user = await requireUser();
  if (!ALLOWED_ROLES.includes(user.role)) return fail("Sin permisos");

  const db = await createSupabaseAdmin();
  const { error } = await db.from("suppliers").update({ is_active: next }).eq("id", id);

  if (error) return fail(error.message);
  revalidatePath(REVALIDATE);
  return okVoid();
}
