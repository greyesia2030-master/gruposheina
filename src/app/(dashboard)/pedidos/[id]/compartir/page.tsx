import { createSupabaseServer } from "@/lib/supabase/server";
import { CompartirClient } from "./compartir-client";

export default async function CompartirPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, status, organization_id, menu_id,
      organizations(name, email, primary_contact_email),
      order_form_tokens(id, token, valid_until, max_uses, used_count, is_active),
      order_sections(id, name, closed_at, total_quantity, display_order, order_participants(id))
    `)
    .eq("id", params.id)
    .single();

  return <CompartirClient order={order as never} />;
}
