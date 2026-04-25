import { createAdminClient } from "@/lib/supabase/admin-client";
import { ParticipantesClient } from "./participantes-client";

type RawLine = {
  id: string;
  quantity: number;
  day_of_week: number;
  display_name: string;
  menu_item_id: string;
  participant_id: string;
};

type RawParticipant = {
  id: string;
  display_name: string;
  submitted_at: string | null;
  total_quantity: number;
  last_activity_at: string;
  member_contact: string | null;
  contact_type: "email" | "phone" | "none";
  is_authorized: boolean | null;
};

type SectionList = Array<{
  id: string;
  name: string;
  closed_at: string | null;
  total_quantity: number;
  display_order: number;
  order_participants: Array<
    RawParticipant & {
      order_lines: Array<Omit<RawLine, "participant_id">>;
    }
  >;
}>;

export default async function ParticipantesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  // Query 1: sections + participants (sin order_lines anidado — evita FK participant_id)
  const { data: sections } = await db
    .from("order_sections")
    .select(`
      id, name, closed_at, total_quantity, display_order,
      order_participants(
        id, display_name, submitted_at, total_quantity, last_activity_at,
        member_contact, contact_type, is_authorized
      )
    `)
    .eq("order_id", id)
    .order("display_order");

  // Query 2: todas las lines del pedido con participant_id
  const { data: lines } = await db
    .from("order_lines")
    .select("id, quantity, day_of_week, display_name, menu_item_id, participant_id")
    .eq("order_id", id)
    .not("participant_id", "is", null);

  // Mapa participantId → lines[]
  const linesByParticipant = ((lines ?? []) as unknown as RawLine[]).reduce<
    Record<string, Omit<RawLine, "participant_id">[]>
  >((acc, l) => {
    const { participant_id, ...rest } = l;
    (acc[participant_id] ??= []).push(rest);
    return acc;
  }, {});

  // Enriquecer cada participante con sus lines
  const sectionList = ((sections ?? []) as unknown as Array<{
    id: string;
    name: string;
    closed_at: string | null;
    total_quantity: number;
    display_order: number;
    order_participants: RawParticipant[];
  }>).map((sec) => ({
    ...sec,
    order_participants: sec.order_participants.map((p) => ({
      ...p,
      order_lines: linesByParticipant[p.id] ?? [],
    })),
  }));

  return <ParticipantesClient orderId={id} sectionList={sectionList as unknown as SectionList} />;
}
