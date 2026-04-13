"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { canManageClients } from "@/lib/permissions";

export async function addAuthorizedPhoneAction(
  orgId: string,
  phone: string
): Promise<{ error?: string } | void> {
  const user = await requireUser();
  if (!canManageClients(user.role)) return { error: "Sin permisos" };

  const e164 = /^\+\d{10,15}$/.exec(phone);
  if (!e164) return { error: "Formato inválido. Usá +549XXXXXXXXXX" };

  const supabase = await createSupabaseAdmin();

  // Verificar que no esté duplicado
  const { data: org } = await supabase
    .from("organizations")
    .select("authorized_phones")
    .eq("id", orgId)
    .single();
  if (!org) return { error: "Organización no encontrada" };

  const list: string[] = org.authorized_phones ?? [];
  if (list.includes(phone)) return { error: "Ese teléfono ya está en la lista" };

  await supabase
    .from("organizations")
    .update({ authorized_phones: [...list, phone] })
    .eq("id", orgId);

  revalidatePath(`/clientes/${orgId}`);
}

export async function removeAuthorizedPhoneAction(
  orgId: string,
  phone: string
): Promise<void> {
  const user = await requireUser();
  if (!canManageClients(user.role)) return;

  const supabase = await createSupabaseAdmin();

  const { data: org } = await supabase
    .from("organizations")
    .select("authorized_phones")
    .eq("id", orgId)
    .single();
  if (!org) return;

  const list: string[] = (org.authorized_phones ?? []).filter((p: string) => p !== phone);
  await supabase
    .from("organizations")
    .update({ authorized_phones: list })
    .eq("id", orgId);

  revalidatePath(`/clientes/${orgId}`);
}
