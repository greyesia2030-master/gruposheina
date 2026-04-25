"use server";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin-client";
import { requireUser } from "@/lib/auth/require-user";
import { hasRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { ClientDepartment } from "@/lib/types/database";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin() {
  const user = await requireUser();
  if (!hasRole(user.role, "admin")) throw new Error("No autorizado");
  return user;
}

export async function getClientDepartments(
  organizationId: string
): Promise<ActionResult<ClientDepartment[]>> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("client_departments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as ClientDepartment[] };
}

export async function upsertClientDepartment(
  organizationId: string,
  dept: {
    id?: string;
    name: string;
    expected_participants: number;
    authorized_emails: string[];
  }
): Promise<ActionResult<ClientDepartment>> {
  await requireAdmin();
  const db = createAdminClient();

  if (dept.id) {
    const { data, error } = await db
      .from("client_departments")
      .update({
        name: dept.name.trim(),
        expected_participants: dept.expected_participants,
        authorized_emails: dept.authorized_emails.map((e) => e.toLowerCase().trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dept.id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/clientes/${organizationId}`);
    revalidatePath(`/clientes/${organizationId}/departamentos`);
    return { ok: true, data: data as unknown as ClientDepartment };
  }

  const { data, error } = await db
    .from("client_departments")
    .insert({
      organization_id: organizationId,
      name: dept.name.trim(),
      expected_participants: dept.expected_participants,
      authorized_emails: dept.authorized_emails.map((e) => e.toLowerCase().trim()).filter(Boolean),
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${organizationId}`);
  revalidatePath(`/clientes/${organizationId}/departamentos`);
  return { ok: true, data: data as unknown as ClientDepartment };
}

export async function deleteClientDepartment(
  organizationId: string,
  departmentId: string
): Promise<ActionResult<void>> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("client_departments")
    .delete()
    .eq("id", departmentId)
    .eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${organizationId}`);
  revalidatePath(`/clientes/${organizationId}/departamentos`);
  return { ok: true, data: undefined };
}
