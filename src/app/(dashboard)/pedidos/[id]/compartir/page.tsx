import { createAdminClient } from "@/lib/supabase/admin-client";
import { CompartirClient } from "./compartir-client";

export default async function CompartirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select(`
      id, status, organization_id, menu_id,
      organizations(name, email, primary_contact_email),
      order_form_tokens(id, token, valid_until, max_uses, used_count, is_active),
      order_sections(id, name, closed_at, total_quantity, display_order, order_participants(id))
    `)
    .eq("id", id)
    .maybeSingle();

  return <CompartirClient order={order as never} />;
}
