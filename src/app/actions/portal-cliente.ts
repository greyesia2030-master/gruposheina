"use server";

import { revalidatePath } from "next/cache";
import { format, parseISO, addDays } from "date-fns";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { requireUser } from "@/lib/auth/require-user";
import { createOrderEvent } from "@/lib/orders/events";
import { insertPlaceholders } from "@/lib/orders/placeholders";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Close order ─────────────────────────────────────────────────────────────

export async function clientAdminCloseOrder(
  orderId: string
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "No autenticado" };
  }

  if (!user.organizationId) return { ok: false, error: "Sin organización asignada" };
  if (user.role !== "client_admin") return { ok: false, error: "Se requiere rol de administrador de cliente" };

  const supabase = await createSupabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, organization_id")
    .eq("id", orderId)
    .eq("organization_id", user.organizationId)
    .single();

  if (!order) return { ok: false, error: "Pedido no encontrado" };

  const closeable = ["draft", "partially_filled"];
  if (!closeable.includes(order.status)) {
    return { ok: false, error: "El pedido no puede cerrarse en su estado actual" };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "awaiting_confirmation" })
    .eq("id", orderId);

  if (updateError) return { ok: false, error: updateError.message };

  try {
    await createOrderEvent({
      orderId,
      eventType: "confirmed",
      actorId: user.id,
      actorRole: "client",
      payload: { action: "client_closed", newStatus: "awaiting_confirmation" },
    });
  } catch {
    /* non-critical — order already updated */
  }

  revalidatePath(`/mi-portal/pedidos/${orderId}`);
  revalidatePath("/mi-portal/pedidos");

  return { ok: true, data: undefined };
}

// ─── Get published menus + active departments for portal modal ────────────────

export async function getPublishedMenusAndDepts(): Promise<
  ActionResult<{
    menus: { id: string; week_label: string; week_start: string; week_number: number }[];
    departments: { id: string; name: string }[];
  }>
> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "No autenticado" };
  }

  if (!user.organizationId) return { ok: false, error: "Sin organización asignada" };

  const db = createAdminClient();

  const { data: rawMenus, error: menusError } = await db
    .from("weekly_menus")
    .select("id, week_start, week_end, week_number, status")
    .eq("status", "published")
    .order("week_start", { ascending: false });

  if (menusError) return { ok: false, error: menusError.message };

  const menus = (rawMenus ?? []).map((m) => ({
    id: m.id,
    week_number: m.week_number,
    week_start: m.week_start,
    week_label: `Semana ${m.week_number} · ${format(parseISO(m.week_start), "dd/MM")} al ${format(parseISO(m.week_end), "dd/MM")}`,
  }));

  const { data: departments, error: deptsError } = await db
    .from("client_departments")
    .select("id, name")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("display_order");

  if (deptsError) return { ok: false, error: deptsError.message };

  return { ok: true, data: { menus, departments: departments ?? [] } };
}

// ─── Create order as client_admin ─────────────────────────────────────────────

export async function createOrderAsClientAdmin(input: {
  menuId: string;
  weekLabel: string;
}): Promise<ActionResult<{ orderId: string; orderCode: string; formToken: string }>> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "No autenticado" };
  }

  if (!user.organizationId) return { ok: false, error: "Sin organización asignada" };
  if (!["client_admin", "superadmin", "admin"].includes(user.role)) {
    return { ok: false, error: "Se requiere rol de administrador de cliente" };
  }

  const db = createAdminClient();

  // Validate menu is published
  const { data: menu } = await db
    .from("weekly_menus")
    .select("id, status")
    .eq("id", input.menuId)
    .eq("status", "published")
    .single();

  if (!menu) return { ok: false, error: "Menú no disponible o no publicado" };

  // Validate no duplicate active order for this org + menu
  const { data: existing } = await db
    .from("orders")
    .select("id, order_code")
    .eq("organization_id", user.organizationId)
    .eq("menu_id", input.menuId)
    .in("status", ["draft", "awaiting_confirmation", "confirmed", "in_production", "partially_filled"])
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      error: `Ya existe un pedido en curso para esta semana (${existing.order_code ?? existing.id})`,
    };
  }

  // Step 1: Create order
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      organization_id: user.organizationId,
      menu_id: input.menuId,
      week_label: input.weekLabel.trim(),
      status: "draft",
      source: "web_form",
      creation_mode: "client_self_serve",
      total_units: 0,
      confirmed_by: user.id,
    })
    .select("id, order_code")
    .single();

  if (orderError || !order) {
    return { ok: false, error: orderError?.message ?? "Error al crear pedido" };
  }

  // Step 2: Get active departments for section creation
  const { data: departments } = await db
    .from("client_departments")
    .select("id, name, display_order, expected_participants")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("display_order");

  // Step 3: Create sections from departments
  if (departments?.length) {
    const sectionInserts = departments.map((dept, i) => ({
      order_id: order.id,
      name: dept.name,
      display_order: dept.display_order ?? i,
      client_department_id: dept.id,
      expected_participants: dept.expected_participants ?? 0,
      total_quantity: 0,
    }));

    const { data: insertedSections, error: sectionsError } = await db
      .from("order_sections")
      .insert(sectionInserts)
      .select("id, client_department_id");

    if (sectionsError) {
      await db.from("orders").delete().eq("id", order.id);
      return { ok: false, error: sectionsError.message };
    }

    // Pre-generate placeholder participants from authorized_emails (non-critical)
    try {
      await insertPlaceholders(
        order.id,
        (insertedSections ?? []).map((s) => ({
          id: s.id,
          client_department_id: (s as unknown as { client_department_id: string | null }).client_department_id ?? null,
        }))
      );
    } catch { /* non-critical */ }
  }

  // Step 4: Create form token (14 days validity)
  const validUntil = addDays(new Date(), 14);
  const token = crypto.randomUUID();

  const { data: formToken, error: tokenError } = await db
    .from("order_form_tokens")
    .insert({
      organization_id: user.organizationId,
      menu_id: input.menuId,
      order_id: order.id,
      token,
      valid_from: new Date().toISOString(),
      valid_until: validUntil.toISOString(),
      max_uses: 100,
      used_count: 0,
      created_by: user.id,
      is_active: true,
      require_contact: true,
    })
    .select("id, token")
    .single();

  if (tokenError || !formToken) {
    await db.from("order_sections").delete().eq("order_id", order.id);
    await db.from("orders").delete().eq("id", order.id);
    return { ok: false, error: tokenError?.message ?? "Error al crear token de formulario" };
  }

  // Step 5: Link token to order
  await db
    .from("orders")
    .update({ form_token_id: formToken.id })
    .eq("id", order.id);

  // Step 6: Audit event
  try {
    await createOrderEvent({
      orderId: order.id,
      eventType: "created",
      actorId: user.id,
      actorRole: "client",
      payload: { creation_mode: "client_self_serve" },
    });
  } catch {
    /* non-critical */
  }

  revalidatePath("/mi-portal/pedidos");

  return {
    ok: true,
    data: {
      orderId: order.id,
      orderCode: order.order_code ?? order.id,
      formToken: formToken.token,
    },
  };
}
