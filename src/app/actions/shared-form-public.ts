"use server";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin-client";
import { sendCommunication } from "@/app/actions/communications";
import { sendPushToOrderParticipants } from "@/app/actions/push";
import { getCutoffDateTime } from "@/lib/time";
import { subDays } from "date-fns";
import type { MenuItem, OrderParticipant, OrderSection, OrderFormToken } from "@/lib/types/database";
import type { OrderParticipantWithLines } from "@/lib/types/order-participant";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── getSharedFormData ────────────────────────────────────────────────────────
// Punto de entrada principal del formulario público.
// Valida el token y retorna todo lo necesario para renderizar el formulario.

export type FormUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export async function getSharedFormData(token: string): Promise<
  ActionResult<{
    orderId: string;
    menuId: string;
    organizationId: string;
    sectionNames: { id: string; name: string }[];
    items: MenuItem[];
    requireContact: boolean;
    users: FormUser[];
    cutoffAt: string | null;
  }>
> {
  const db = createAdminClient();

  const { data: tokenRow, error } = await db
    .from("order_form_tokens")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  const tokenPrefix = token ? token.slice(0, 8) : "(undefined)";

  if (error || !tokenRow) {
    console.log(`[${ts()}] getSharedFormData: token not found — ${tokenPrefix}...`);
    return { ok: false, error: "invalid" };
  }

  if (new Date(tokenRow.valid_until) < new Date()) {
    console.log(`[${ts()}] getSharedFormData: token expired — ${tokenPrefix}...`);
    return { ok: false, error: "expired" };
  }

  if (tokenRow.max_uses > 0 && tokenRow.used_count >= tokenRow.max_uses) {
    console.log(`[${ts()}] getSharedFormData: token maxed out — ${tokenPrefix}...`);
    return { ok: false, error: "maxed_out" };
  }

  if (!tokenRow.order_id || !tokenRow.menu_id) {
    return { ok: false, error: "invalid" };
  }

  const [sectionsRes, itemsRes, usersRes, orgRes, menuRes, orderRes] = await Promise.all([
    db
      .from("order_sections")
      .select("id, name, display_order")
      .eq("order_id", tokenRow.order_id)
      .order("display_order", { ascending: true }),
    db
      .from("menu_items")
      .select("*")
      .eq("menu_id", tokenRow.menu_id)
      .eq("is_available", true)
      .eq("is_published_to_form", true)
      .order("day_of_week", { ascending: true }),
    db
      .from("users")
      .select("id, full_name, email, phone")
      .eq("organization_id", tokenRow.organization_id)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    db
      .from("organizations")
      .select("cutoff_time, cutoff_days_before, timezone")
      .eq("id", tokenRow.organization_id)
      .maybeSingle(),
    db
      .from("weekly_menus")
      .select("week_start")
      .eq("id", tokenRow.menu_id)
      .maybeSingle(),
    db
      .from("orders")
      .select("custom_cutoff_at")
      .eq("id", tokenRow.order_id)
      .maybeSingle(),
  ]);

  const sections = sectionsRes.data ?? [];
  const items = itemsRes.data ?? [];
  const users = (usersRes.data ?? []) as FormUser[];

  // Compute cutoff — prefer custom, fallback to org formula
  let cutoffAt: string | null = null;
  const customCutoff = (orderRes.data as unknown as { custom_cutoff_at?: string | null } | null)?.custom_cutoff_at ?? null;
  if (customCutoff) {
    cutoffAt = customCutoff;
  } else if (orgRes.data && menuRes.data) {
    const org = orgRes.data as { cutoff_time: string; cutoff_days_before: number; timezone: string };
    const base = new Date(menuRes.data.week_start + "T12:00:00Z");
    const shifted = subDays(base, org.cutoff_days_before);
    cutoffAt = getCutoffDateTime(shifted, org.timezone, org.cutoff_time).toISOString();
  }

  console.log(
    `[${ts()}] getSharedFormData: ok — order ${tokenRow.order_id.slice(0, 8)}, ` +
    `${sections.length} secciones, ${items.length} items, ${users.length} users`
  );

  return {
    ok: true,
    data: {
      orderId: tokenRow.order_id,
      menuId: tokenRow.menu_id,
      organizationId: tokenRow.organization_id,
      sectionNames: sections.map((s) => ({ id: s.id, name: s.name })),
      items: items as unknown as MenuItem[],
      requireContact: (tokenRow as unknown as { require_contact?: boolean }).require_contact ?? true,
      users,
      cutoffAt,
    },
  };
}

// ─── resolveFormToken ─────────────────────────────────────────────────────────
// Retorna el token crudo + secciones. Usado internamente y por el layout público.

export async function resolveFormToken(
  token: string
): Promise<ActionResult<{ formToken: OrderFormToken; sections: OrderSection[] }>> {
  const db = createAdminClient();

  const { data: tokenRow, error } = await db
    .from("order_form_tokens")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !tokenRow) return { ok: false, error: "Token inválido o expirado" };
  if (new Date(tokenRow.valid_until) < new Date()) return { ok: false, error: "Token expirado" };
  if (tokenRow.max_uses > 0 && tokenRow.used_count >= tokenRow.max_uses) return { ok: false, error: "Token agotado" };
  if (!tokenRow.order_id) return { ok: false, error: "Token sin pedido asociado" };

  const { data: sections } = await db
    .from("order_sections")
    .select("*")
    .eq("order_id", tokenRow.order_id)
    .order("display_order", { ascending: true });

  return {
    ok: true,
    data: {
      formToken: tokenRow as unknown as OrderFormToken,
      sections: (sections ?? []) as unknown as OrderSection[],
    },
  };
}

// ─── joinSection ──────────────────────────────────────────────────────────────
// Registra un participante en una sección. Incrementa used_count del token.

export async function joinSection(
  token: string,
  sectionId: string,
  displayName: string,
  memberContact?: string,
  userId?: string
): Promise<ActionResult<OrderParticipant>> {
  const db = createAdminClient();

  // Re-validate token
  const tokenRes = await resolveFormToken(token);
  if (!tokenRes.ok) return tokenRes;
  const { formToken } = tokenRes.data;

  // Verify sectionId belongs to this token's order
  const { data: section } = await db
    .from("order_sections")
    .select("id, order_id, closed_at")
    .eq("id", sectionId)
    .maybeSingle();

  if (!section) return { ok: false, error: "Sección no encontrada" };
  if (section.order_id !== formToken.order_id) return { ok: false, error: "Sección no pertenece a este formulario" };
  if (section.closed_at) return { ok: false, error: "La sección ya está cerrada" };

  // If userId provided, resolve user and override displayName + contact
  let resolvedDisplayName = displayName;
  let resolvedContact = memberContact;
  if (userId) {
    const { data: user } = await db
      .from("users")
      .select("id, full_name, email, phone, organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!user) return { ok: false, error: "Usuario no encontrado" };
    const userRow = user as unknown as { full_name: string; email: string | null; phone: string | null; organization_id: string };
    if (userRow.organization_id !== formToken.organization_id) {
      return { ok: false, error: "Usuario no pertenece a esta organización" };
    }
    resolvedDisplayName = userRow.full_name;
    resolvedContact = userRow.email ?? userRow.phone ?? undefined;
  }

  // Classify and authorize contact
  const contact = resolvedContact?.trim() || null;
  let contactType: "email" | "phone" | "none" = "none";
  let isAuthorized: boolean | null = null;

  if (contact) {
    if (contact.includes("@")) {
      contactType = "email";
      // B.10.5: Check dept-specific authorized_emails first, fallback to org secondary_emails
      const normalizedContact = contact.toLowerCase();

      const [deptRes, orgRes] = await Promise.all([
        db
          .from("client_departments")
          .select("authorized_emails")
          .eq("organization_id", formToken.organization_id)
          .ilike("name", (section as { name?: string }).name ?? "")
          .maybeSingle(),
        db
          .from("organizations")
          .select("primary_contact_email, secondary_emails")
          .eq("id", formToken.organization_id)
          .maybeSingle(),
      ]);

      const deptEmails = ((deptRes.data as unknown as { authorized_emails?: string[] } | null)
        ?.authorized_emails ?? []).map((e) => e.toLowerCase());

      if (deptEmails.length > 0) {
        isAuthorized = deptEmails.includes(normalizedContact);
        if (!isAuthorized) {
          // Fallback to org-level
          const orgEmails = [
            (orgRes.data as unknown as { primary_contact_email?: string | null } | null)
              ?.primary_contact_email,
            ...((orgRes.data as unknown as { secondary_emails?: string[] } | null)
              ?.secondary_emails ?? []),
          ]
            .filter(Boolean)
            .map((e) => (e as string).toLowerCase());
          if (orgEmails.includes(normalizedContact)) {
            console.warn(`[joinSection] email matched org-level but not dept "${(section as { name?: string }).name}" — marking authorized`);
            isAuthorized = true;
          }
        }
      } else {
        // No dept config — fall back to org secondary_emails only
        const orgEmails = [
          (orgRes.data as unknown as { primary_contact_email?: string | null } | null)
            ?.primary_contact_email,
          ...((orgRes.data as unknown as { secondary_emails?: string[] } | null)
            ?.secondary_emails ?? []),
        ]
          .filter(Boolean)
          .map((e) => (e as string).toLowerCase());
        isAuthorized = orgEmails.includes(normalizedContact);
      }
    } else if (/^[\d\s+\-()]+$/.test(contact)) {
      contactType = "phone";
      const cleanContact = contact.replace(/\D/g, "");
      const { data: org } = await db
        .from("organizations")
        .select("contact_phone, authorized_phones")
        .eq("id", formToken.organization_id)
        .maybeSingle();
      const allPhones = [
        (org as unknown as { contact_phone: string | null } | null)?.contact_phone,
        ...((org as unknown as { authorized_phones: string[] } | null)?.authorized_phones ?? []),
      ]
        .filter(Boolean)
        .map((p) => (p as string).replace(/\D/g, ""));
      isAuthorized = allPhones.some((p) => p.endsWith(cleanContact.slice(-8)));
    }
  }

  // Check for existing placeholder (email-based, submitted_at IS NULL)
  if (contact && contactType === "email") {
    const { data: existing } = await db
      .from("order_participants")
      .select("id")
      .eq("section_id", sectionId)
      .eq("member_contact", contact.toLowerCase())
      .is("submitted_at", null)
      .maybeSingle();

    if (existing) {
      const { data: occupied, error: occupyError } = await db
        .from("order_participants")
        .update({
          display_name: resolvedDisplayName.trim(),
          form_token_id: formToken.id,
          first_seen_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          is_authorized: isAuthorized,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (occupyError || !occupied) {
        return { ok: false, error: "Error al registrar participante" };
      }

      await db
        .from("order_form_tokens")
        .update({ used_count: formToken.used_count + 1 })
        .eq("id", formToken.id);

      console.log(`[${ts()}] joinSection: occupied placeholder ${existing.id.slice(0, 8)}, section ${sectionId.slice(0, 8)}`);
      return { ok: true, data: occupied as unknown as OrderParticipant };
    }
  }

  // Create participant
  const { data: participant, error: insertError } = await db
    .from("order_participants")
    .insert({
      order_id: formToken.order_id!,
      section_id: sectionId,
      display_name: resolvedDisplayName.trim(),
      form_token_id: formToken.id,
      first_seen_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      member_contact: contact,
      contact_type: contactType,
      is_authorized: isAuthorized,
    })
    .select("*")
    .single();

  if (insertError || !participant) {
    console.error(`[${ts()}] joinSection: insert error`, insertError?.message);
    return { ok: false, error: insertError?.message ?? "Error al registrar participante" };
  }

  // Increment token used_count
  await db
    .from("order_form_tokens")
    .update({ used_count: formToken.used_count + 1 })
    .eq("id", formToken.id);

  console.log(`[${ts()}] joinSection: ok — participant ${participant.id.slice(0, 8)}, section ${sectionId.slice(0, 8)}`);
  return { ok: true, data: participant as unknown as OrderParticipant };
}

// ─── getMenuItemsForToken ─────────────────────────────────────────────────────

export async function getMenuItemsForToken(
  token: string
): Promise<ActionResult<MenuItem[]>> {
  const db = createAdminClient();

  const { data: tokenRow } = await db
    .from("order_form_tokens")
    .select("menu_id, is_active, valid_until")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow?.is_active || !tokenRow.menu_id) return { ok: false, error: "Token inválido" };
  if (new Date(tokenRow.valid_until) < new Date()) return { ok: false, error: "Token expirado" };

  const { data: items, error } = await db
    .from("menu_items")
    .select("*")
    .eq("menu_id", tokenRow.menu_id)
    .eq("is_available", true)
    .eq("is_published_to_form", true)
    .order("day_of_week", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (items ?? []) as unknown as MenuItem[] };
}

// ─── getParticipantCart ───────────────────────────────────────────────────────

export async function getParticipantCart(
  accessToken: string
): Promise<ActionResult<OrderParticipantWithLines>> {
  const db = createAdminClient();

  const { data: participant } = await db
    .from("order_participants")
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!participant) return { ok: false, error: "Participante no encontrado" };

  const { data: lines } = await db
    .from("order_lines")
    .select("*")
    .eq("order_id", participant.order_id)
    .eq("participant_id", participant.id);

  return {
    ok: true,
    data: {
      ...(participant as unknown as OrderParticipant),
      lines: lines ?? [],
    },
  };
}

// ─── upsertCartLine ───────────────────────────────────────────────────────────
// quantity=0 elimina la línea existente si la hay.

export async function upsertCartLine(
  accessToken: string,
  menuItemId: string,
  dayOfWeek: number,
  quantity: number
): Promise<ActionResult<void>> {
  const db = createAdminClient();

  const { data: participant } = await db
    .from("order_participants")
    .select("id, order_id, section_id")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!participant) return { ok: false, error: "Participante no encontrado" };
  if (!participant.section_id) return { ok: false, error: "Participante sin sección asignada" };

  // Check section is still open
  const { data: section } = await db
    .from("order_sections")
    .select("closed_at")
    .eq("id", participant.section_id)
    .maybeSingle();

  if (section?.closed_at) return { ok: false, error: "La sección ya fue cerrada" };

  // Find existing line for this participant + item + day
  const { data: existing } = await db
    .from("order_lines")
    .select("id")
    .eq("order_id", participant.order_id)
    .eq("participant_id", participant.id)
    .eq("menu_item_id", menuItemId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (quantity <= 0) {
    if (existing) {
      await db.from("order_lines").delete().eq("id", existing.id);
    }
    await db
      .from("order_participants")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", participant.id);
    return { ok: true, data: undefined };
  }

  if (existing) {
    const { error } = await db
      .from("order_lines")
      .update({ quantity })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // Fetch menu item for option_code + display_name
    const { data: menuItem } = await db
      .from("menu_items")
      .select("option_code, display_name")
      .eq("id", menuItemId)
      .maybeSingle();

    if (!menuItem) return { ok: false, error: "Opción de menú no encontrada" };

    const { error } = await db.from("order_lines").insert({
      order_id: participant.order_id,
      menu_item_id: menuItemId,
      day_of_week: dayOfWeek,
      department: "participante",
      quantity,
      unit_price: 0,
      option_code: menuItem.option_code,
      display_name: menuItem.display_name,
      section_id: participant.section_id,
      participant_id: participant.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  await db
    .from("order_participants")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", participant.id);

  return { ok: true, data: undefined };
}

// ─── submitCart ───────────────────────────────────────────────────────────────
// Cierra la sección del participante. El trigger DB promueve el order si todas cerradas.

export async function submitCart(
  accessToken: string
): Promise<ActionResult<{ allSectionsClosed: boolean; participantId: string }>> {
  const db = createAdminClient();

  const { data: participant } = await db
    .from("order_participants")
    .select("id, section_id")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!participant) return { ok: false, error: "Participante no encontrado" };
  if (!participant.section_id) return { ok: false, error: "Participante sin sección asignada" };

  // Validate at least 1 unit selected before closing the section
  const { data: lines } = await db
    .from("order_lines")
    .select("quantity")
    .eq("participant_id", participant.id);
  const totalQty = (lines ?? []).reduce((s, l) => s + (l.quantity ?? 0), 0);
  if (totalQty === 0) {
    return { ok: false, error: "Tenés que seleccionar al menos 1 vianda antes de enviar" };
  }

  const result = await closeOrderSectionFromPublicForm(participant.section_id, participant.id);
  if (!result.ok) return result;
  return { ok: true, data: { ...result.data, participantId: participant.id } };
}

// ─── recordOrderLineFromPublicForm ────────────────────────────────────────────
// INSERT directo en order_lines con validación de sección abierta.

export async function recordOrderLineFromPublicForm(params: {
  orderId: string;
  sectionId: string;
  participantId: string;
  menuItemId: string;
  quantity: number;
  dayOfWeek: number;
}): Promise<ActionResult<{ lineId: string }>> {
  const db = createAdminClient();
  const { orderId, sectionId, participantId, menuItemId, quantity, dayOfWeek } = params;

  // Validate section is open and belongs to order
  const { data: section } = await db
    .from("order_sections")
    .select("id, closed_at, order_id")
    .eq("id", sectionId)
    .maybeSingle();

  if (!section) return { ok: false, error: "Sección no encontrada" };
  if (section.closed_at) return { ok: false, error: "La sección ya está cerrada" };
  if (section.order_id !== orderId) return { ok: false, error: "Sección no pertenece al pedido" };

  // Validate participant belongs to section
  const { data: participant } = await db
    .from("order_participants")
    .select("id, section_id")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) return { ok: false, error: "Participante no encontrado" };
  if (participant.section_id !== sectionId) return { ok: false, error: "Participante no pertenece a la sección" };

  // Fetch menu item
  const { data: menuItem } = await db
    .from("menu_items")
    .select("option_code, display_name")
    .eq("id", menuItemId)
    .maybeSingle();

  if (!menuItem) return { ok: false, error: "Opción de menú no encontrada" };

  const { data: line, error: insertError } = await db
    .from("order_lines")
    .insert({
      order_id: orderId,
      menu_item_id: menuItemId,
      day_of_week: dayOfWeek,
      department: "participante",
      quantity,
      unit_price: 0,
      option_code: menuItem.option_code,
      display_name: menuItem.display_name,
      section_id: sectionId,
      participant_id: participantId,
    })
    .select("id")
    .single();

  if (insertError || !line) {
    console.error(`[${ts()}] recordOrderLineFromPublicForm: error`, insertError?.message);
    return { ok: false, error: insertError?.message ?? "Error al registrar la línea" };
  }

  await db
    .from("order_participants")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", participantId);

  console.log(`[${ts()}] recordOrderLineFromPublicForm: ok — line ${line.id.slice(0, 8)}, qty ${quantity}`);
  return { ok: true, data: { lineId: line.id } };
}

// ─── closeOrderSectionFromPublicForm ─────────────────────────────────────────
// Cierra la sección vía fn_close_order_section (que calcula totales).
// El trigger trg_check_sections_closed promueve el order automáticamente.

export async function closeOrderSectionFromPublicForm(
  sectionId: string,
  participantId: string
): Promise<ActionResult<{ allSectionsClosed: boolean }>> {
  const db = createAdminClient();

  // Validate participant belongs to section
  const { data: participant } = await db
    .from("order_participants")
    .select("id, section_id, order_id")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) return { ok: false, error: "Participante no encontrado" };
  if (participant.section_id !== sectionId) return { ok: false, error: "Participante no pertenece a la sección" };

  // Close section via DB function — trigger fires and updates order status
  const { error: rpcError } = await db.rpc("fn_close_order_section", {
    p_section_id: sectionId,
    p_participant_id: participantId,
  });

  if (rpcError) {
    console.error(`[${ts()}] closeOrderSectionFromPublicForm: rpc error`, rpcError.message);
    return { ok: false, error: rpcError.message };
  }

  // Mark participant submitted
  await db
    .from("order_participants")
    .update({
      submitted_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", participantId);

  // Check order status — trigger sets 'awaiting_confirmation' when all sections closed
  const { data: order } = await db
    .from("orders")
    .select("status, organization_id, week_label, order_code")
    .eq("id", participant.order_id)
    .maybeSingle();

  const allSectionsClosed = order?.status === "awaiting_confirmation";

  console.log(
    `[${ts()}] closeOrderSectionFromPublicForm: ok — section ${sectionId.slice(0, 8)}, ` +
    `allClosed=${allSectionsClosed}`
  );

  // [B.7] Enviar email al referente cuando todas las secciones están cerradas
  if (allSectionsClosed && order) {
    try {
      const { data: org } = await db
        .from("organizations")
        .select("id, name, primary_contact_email")
        .eq("id", order.organization_id)
        .maybeSingle();

      if (org?.primary_contact_email) {
        const { data: tmpl } = await db
          .from("communication_templates")
          .select("id")
          .eq("name", "pedido_cerrado_cliente_referente")
          .eq("is_active", true)
          .maybeSingle();

        if (tmpl) {
          const [linesRes, partsRes, secsRes] = await Promise.all([
            db
              .from("order_lines")
              .select("id", { count: "exact", head: true })
              .eq("order_id", participant.order_id),
            db
              .from("order_participants")
              .select("id", { count: "exact", head: true })
              .eq("order_id", participant.order_id),
            db
              .from("order_sections")
              .select("id", { count: "exact", head: true })
              .eq("order_id", participant.order_id),
          ]);

          const commResult = await sendCommunication(
            (org.id as string),
            "email",
            "pedido_confirmacion",
            org.primary_contact_email as string,
            "",
            {
              orderId: participant.order_id,
              templateId: (tmpl.id as string),
              templateVariables: {
                week_label: order.week_label,
                organization_name: org.name as string,
                order_code: order.order_code,
                total_lines: (linesRes.count ?? 0).toString(),
                total_participants: (partsRes.count ?? 0).toString(),
                closed_sections: (secsRes.count ?? 0).toString(),
                total_sections: (secsRes.count ?? 0).toString(),
              },
            }
          );

          if (commResult.ok) {
            console.log(`[${ts()}] [B.7] Email referente enviado: ${org.primary_contact_email}`);
          } else {
            console.error(`[${ts()}] [B.7] sendCommunication falló:`, commResult.error);
          }
        }
      }
    } catch (err) {
      console.error(`[${ts()}] [B.7] Error enviando email referente (no bloquea):`, err);
    }

    // [C.1.3] Push notification a todos los participantes con suscripción activa
    try {
      await sendPushToOrderParticipants(participant.order_id, {
        title: "Grupo Sheina — Pedido listo",
        body: `El pedido ${order?.order_code ?? ""} fue confirmado. El equipo de Sheina ya tiene tu selección.`,
        url: `/pedido`,
      });
    } catch (err) {
      console.error(`[${ts()}] [C.1.3] Error enviando push (no bloquea):`, err);
    }
  }

  return { ok: true, data: { allSectionsClosed } };
}
