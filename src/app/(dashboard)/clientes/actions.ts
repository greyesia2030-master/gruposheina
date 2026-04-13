"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { canManageClients } from "@/lib/permissions";

// ── Helpers ────────────────────────────────────────────────────────────────

function fail(error: string) {
  return { ok: false as const, error };
}
function ok() {
  return { ok: true as const };
}

// ── createOrganizationAction ───────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  cuit: z.string().trim().optional(),
  contact_phone: z
    .string()
    .regex(/^\+549\d{10}$/, "Formato inválido. Usá +549XXXXXXXXXX"),
  email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  delivery_address: z.string().trim().optional(),
  price_per_unit: z.coerce.number().min(1, "Precio obligatorio"),
  departments: z.array(z.string().trim().min(1)).min(1, "Al menos un departamento"),
  cutoff_time: z.string().default("18:00"),
  cutoff_days_before: z.coerce.number().int().min(0).default(1),
});

export async function createOrganizationAction(
  data: z.input<typeof createOrgSchema>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const actor = await requireUser();
  if (!canManageClients(actor.role)) return fail("Sin permisos");

  const parsed = createOrgSchema.safeParse(data);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const d = parsed.data;

  const supabase = await createSupabaseAdmin();

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: d.name,
      cuit: d.cuit || null,
      contact_phone: d.contact_phone,
      email: d.email || null,
      delivery_address: d.delivery_address || null,
      price_per_unit: d.price_per_unit,
      departments: d.departments,
      cutoff_time: d.cutoff_time,
      cutoff_days_before: d.cutoff_days_before,
      status: "active",
      authorized_phones: [d.contact_phone],
    })
    .select()
    .single();

  if (orgErr || !org) {
    return fail(orgErr?.message ?? "Error al crear organización");
  }

  // Create auth user + client_admin row for the contact phone
  const authEmail =
    d.email || `${d.contact_phone.replace(/\D/g, "")}@cliente.sheina.ar`;

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: authEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: d.name },
  });

  if (authErr || !authData.user) {
    console.error("createOrg: auth user creation failed", authErr?.message);
  } else {
    await supabase.from("users").insert({
      auth_id: authData.user.id,
      organization_id: org.id,
      role: "client_admin",
      full_name: d.name,
      phone: d.contact_phone,
      email: authEmail,
      is_active: true,
    });
  }

  revalidatePath("/clientes");
  return { ok: true, id: org.id };
}

// ── updateOrganizationAction ───────────────────────────────────────────────

const updateOrgSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  cuit: z.string().trim().nullable().optional(),
  contact_phone: z.string().trim().nullable().optional(),
  email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
  delivery_address: z.string().trim().nullable().optional(),
  price_per_unit: z.coerce.number().min(0),
  cutoff_time: z.string(),
  cutoff_days_before: z.coerce.number().int().min(0),
});

export async function updateOrganizationAction(
  orgId: string,
  data: z.input<typeof updateOrgSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireUser();
  if (!canManageClients(actor.role)) return fail("Sin permisos");

  const parsed = updateOrgSchema.safeParse(data);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const d = parsed.data;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: d.name,
      cuit: d.cuit || null,
      contact_phone: d.contact_phone || null,
      email: d.email || null,
      delivery_address: d.delivery_address || null,
      price_per_unit: d.price_per_unit,
      cutoff_time: d.cutoff_time,
      cutoff_days_before: d.cutoff_days_before,
    })
    .eq("id", orgId);

  if (error) return fail(error.message);

  revalidatePath(`/clientes/${orgId}`);
  revalidatePath("/clientes");
  return ok();
}

// ── deactivateOrganizationAction ───────────────────────────────────────────

export async function deactivateOrganizationAction(
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireUser();
  if (!canManageClients(actor.role)) return fail("Sin permisos");

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("organizations")
    .update({ status: "inactive" })
    .eq("id", orgId);

  if (error) return fail(error.message);

  revalidatePath(`/clientes/${orgId}`);
  revalidatePath("/clientes");
  return ok();
}

// ── addUserToOrgAction ─────────────────────────────────────────────────────

const addUserSchema = z.object({
  full_name: z.string().trim().min(1, "Nombre obligatorio"),
  email: z.string().email("Email inválido"),
  phone: z.string().trim().nullable().optional(),
  role: z.enum(["client_admin", "client_user"]).default("client_user"),
});

export async function addUserToOrgAction(
  orgId: string,
  data: z.input<typeof addUserSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireUser();
  if (!canManageClients(actor.role)) return fail("Sin permisos");

  const parsed = addUserSchema.safeParse(data);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const d = parsed.data;

  const supabase = await createSupabaseAdmin();

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: d.email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: d.full_name },
  });

  if (authErr || !authData.user) {
    return fail(authErr?.message ?? "Error al crear usuario de acceso");
  }

  const { error: userErr } = await supabase.from("users").insert({
    auth_id: authData.user.id,
    organization_id: orgId,
    role: d.role,
    full_name: d.full_name,
    phone: d.phone || null,
    email: d.email,
    is_active: true,
  });

  if (userErr) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return fail(userErr.message);
  }

  revalidatePath(`/clientes/${orgId}`);
  return ok();
}
