"use server";
import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { requireUser } from "@/lib/auth/require-user";
import { hasRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function updateOrganizationConfig(
  orgId: string,
  data: {
    cutoff_time: string;
    cutoff_days_before: number;
    primary_contact_email: string | null;
    secondary_emails: string[];
    prefers_web_form: boolean;
    notification_preferences: Record<string, boolean>;
    departments: string[];
  }
): Promise<ActionResult<void>> {
  const currentUser = await requireUser();
  if (!hasRole(currentUser.role, "admin")) {
    return { ok: false, error: "No autorizado" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("organizations")
    .update({
      cutoff_time: data.cutoff_time,
      cutoff_days_before: data.cutoff_days_before,
      primary_contact_email: data.primary_contact_email || null,
      secondary_emails: data.secondary_emails,
      prefers_web_form: data.prefers_web_form,
      notification_preferences: data.notification_preferences,
      departments: data.departments,
    })
    .eq("id", orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${orgId}`);
  revalidatePath(`/clientes/${orgId}/configuracion`);
  return { ok: true, data: undefined };
}
