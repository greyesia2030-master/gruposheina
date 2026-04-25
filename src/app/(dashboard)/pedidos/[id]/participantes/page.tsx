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
  section_id: string;
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
    Omit<RawParticipant, "section_id"> & {
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

  // Query 1: sections planas (sin joins)
  const { data: sections, error: sectionsError } = await db
    .from("order_sections")
    .select("id, name, closed_at, total_quantity, display_order")
    .eq("order_id", id)
    .order("display_order");

  if (sectionsError) {
    console.error("[Participantes] sectionsError:", sectionsError);
  }

  // Query 2: participants planas (todos los de cualquier sección del order)
  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: participants, error: pError } = sectionIds.length > 0
    ? await db
        .from("order_participants")
        .select("id, section_id, display_name, submitted_at, total_quantity, last_activity_at, member_contact, contact_type, is_authorized")
        .in("section_id", sectionIds)
    : { data: [], error: null };

  if (pError) {
    console.error("[Participantes] participantsError:", pError);
  }

  // Query 3: lines por order_id (con participant_id para merge)
  const { data: lines } = await db
    .from("order_lines")
    .select("id, quantity, day_of_week, display_name, menu_item_id, participant_id")
    .eq("order_id", id)
    .not("participant_id", "is", null);

  // Merge: lines por participant_id
  const linesByParticipant = ((lines ?? []) as unknown as RawLine[]).reduce<
    Record<string, Omit<RawLine, "participant_id">[]>
  >((acc, l) => {
    const { participant_id, ...rest } = l;
    (acc[participant_id] ??= []).push(rest);
    return acc;
  }, {});

  // Merge: participants por section_id, agregando sus lines
  const participantsBySection = ((participants ?? []) as RawParticipant[]).reduce<
    Record<string, Array<Omit<RawParticipant, "section_id"> & { order_lines: Omit<RawLine, "participant_id">[] }>>
  >((acc, p) => {
    const { section_id, ...participantData } = p;
    (acc[section_id] ??= []).push({
      ...participantData,
      order_lines: linesByParticipant[p.id] ?? [],
    });
    return acc;
  }, {});

  // Construir sectionList
  const sectionList: SectionList = (sections ?? []).map((sec) => ({
    ...sec,
    order_participants: participantsBySection[sec.id] ?? [],
  }));

  return <ParticipantesClient orderId={id} sectionList={sectionList} />;
}
