import { createAdminClient } from "@/lib/supabase/admin-client";

export async function insertPlaceholders(
  orderId: string,
  sections: { id: string; client_department_id: string | null }[]
): Promise<void> {
  const db = createAdminClient();
  const deptIds = sections.map((s) => s.client_department_id).filter(Boolean) as string[];
  if (deptIds.length === 0) return;

  const { data: depts } = await db
    .from("client_departments")
    .select("id, authorized_emails")
    .in("id", deptIds);

  if (!depts || depts.length === 0) return;

  const deptMap = new Map(
    (depts as unknown as { id: string; authorized_emails: string[] }[]).map((d) => [
      d.id,
      d.authorized_emails ?? [],
    ])
  );

  const placeholders = sections.flatMap((section) => {
    if (!section.client_department_id) return [];
    const emails = deptMap.get(section.client_department_id) ?? [];
    return emails.map((email) => ({
      order_id: orderId,
      section_id: section.id,
      display_name: email,
      member_contact: email.toLowerCase(),
      contact_type: "email" as const,
      is_authorized: true,
      submitted_at: null,
    }));
  });

  if (placeholders.length > 0) {
    await db.from("order_participants").insert(placeholders);
  }
}
