import { createSupabaseServer } from "@/lib/supabase/server";
import { ParticipantesClient } from "./participantes-client";

export default async function ParticipantesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: sections } = await supabase
    .from("order_sections")
    .select(`
      id, name, closed_at, total_quantity, display_order,
      order_participants(
        id, display_name, submitted_at, total_quantity, last_activity_at,
        member_contact, contact_type, is_authorized,
        order_lines(id, quantity, day_of_week, display_name, menu_item_id)
      )
    `)
    .eq("order_id", id)
    .order("display_order");

  const sectionList = (sections ?? []) as unknown as Array<{
    id: string;
    name: string;
    closed_at: string | null;
    total_quantity: number;
    display_order: number;
    order_participants: Array<{
      id: string;
      display_name: string;
      submitted_at: string | null;
      total_quantity: number;
      last_activity_at: string;
      member_contact: string | null;
      contact_type: "email" | "phone" | "none";
      is_authorized: boolean | null;
      order_lines: Array<{
        id: string;
        quantity: number;
        day_of_week: number;
        display_name: string;
        menu_item_id: string;
      }>;
    }>;
  }>;

  return <ParticipantesClient orderId={id} sectionList={sectionList} />;
}
