import { createAdminClient } from "@/lib/supabase/admin-client";
import { CompartirClient } from "./compartir-client";

export default async function CompartirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  // Query 1: order básico
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, status, organization_id, menu_id")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    console.error("[CompartirPage] orderError:", orderError);
  }

  if (!order) {
    return <CompartirClient order={null} />;
  }

  // Query 2: organization
  const { data: organization } = await db
    .from("organizations")
    .select("name, email, primary_contact_email")
    .eq("id", order.organization_id)
    .maybeSingle();

  // Query 3: tokens del pedido
  const { data: tokens } = await db
    .from("order_form_tokens")
    .select("id, token, valid_until, max_uses, used_count, is_active")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  // Query 4: secciones
  const { data: sections } = await db
    .from("order_sections")
    .select("id, name, closed_at, total_quantity, display_order")
    .eq("order_id", id)
    .order("display_order");

  // Query 5: participantes para todas las secciones
  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: participants } = sectionIds.length > 0
    ? await db
        .from("order_participants")
        .select("id, section_id")
        .in("section_id", sectionIds)
    : { data: [] };

  // Merge: agrupar participantes por sección
  const participantsBySection = (participants ?? []).reduce<Record<string, { id: string }[]>>(
    (acc, p) => {
      const part = p as { id: string; section_id: string };
      (acc[part.section_id] ??= []).push({ id: part.id });
      return acc;
    },
    {}
  );

  const sectionsWithParticipants = (sections ?? []).map((s) => ({
    ...s,
    order_participants: participantsBySection[s.id] ?? [],
  }));

  // Construir el shape que espera CompartirClient
  const orderEnriched = {
    ...order,
    organizations: organization,
    order_form_tokens: tokens ?? [],
    order_sections: sectionsWithParticipants,
  };

  return <CompartirClient order={orderEnriched as never} />;
}
