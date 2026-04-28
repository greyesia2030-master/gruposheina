"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, parseISO } from "date-fns";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { createOrderEvent } from "@/lib/orders/events";
import type { UserRole } from "@/lib/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALLOWED_ROLES: readonly UserRole[] = ["superadmin", "admin", "warehouse"];

export async function generateProductionTicketsForOrder(
  orderId: string
): Promise<
  ActionResult<{ tickets: unknown[]; count: number; alreadyExisted?: boolean }>
> {
  const supabase = await createSupabaseAdmin();

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Error de autenticación" };
  }

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    return { ok: false, error: "Tu rol no permite enviar pedidos a producción." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, menu_id, menu:weekly_menus(week_start)")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "Pedido no encontrado" };
  if (order.status !== "confirmed") {
    return {
      ok: false,
      error: `El pedido debe estar confirmado. Estado actual: ${order.status}`,
    };
  }

  // Idempotency check
  const { data: existingTickets } = await supabase
    .from("production_tickets")
    .select("id, menu_item_id, status")
    .eq("order_id", orderId);

  if (existingTickets && existingTickets.length > 0) {
    return {
      ok: true,
      data: {
        tickets: existingTickets,
        count: existingTickets.length,
        alreadyExisted: true,
      },
    };
  }

  const { data: lines } = await supabase
    .from("order_lines")
    .select("menu_item_id, day_of_week, quantity")
    .eq("order_id", orderId);

  if (!lines || lines.length === 0) {
    return { ok: false, error: "El pedido no tiene líneas" };
  }

  const menuItemIds = [...new Set(lines.map((l) => l.menu_item_id as string))];
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, recipe_version_id")
    .in("id", menuItemIds);

  const recipeMap = new Map(
    (menuItems ?? []).map((mi) => [mi.id as string, mi.recipe_version_id as string | null])
  );

  // Aggregate by (menu_item_id, day_of_week)
  const groups = new Map<
    string,
    { menu_item_id: string; day_of_week: number; quantity: number }
  >();
  for (const line of lines) {
    const key = `${line.menu_item_id}_${line.day_of_week}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += (line.quantity as number) ?? 0;
    } else {
      groups.set(key, {
        menu_item_id: line.menu_item_id as string,
        day_of_week: line.day_of_week as number,
        quantity: (line.quantity as number) ?? 0,
      });
    }
  }

  const menu = order.menu as unknown as { week_start: string } | null;
  if (!menu?.week_start) return { ok: false, error: "El pedido no tiene menú asignado" };

  const weekStart = parseISO(menu.week_start);

  const ticketInserts = [...groups.values()].map((g) => ({
    order_id: orderId,
    menu_item_id: g.menu_item_id,
    recipe_version_id: recipeMap.get(g.menu_item_id) ?? null,
    cook_site_id: null as string | null,
    production_date: format(addDays(weekStart, g.day_of_week - 1), "yyyy-MM-dd"),
    quantity_target: g.quantity,
    quantity_produced: 0,
    quantity_wasted: 0,
    status: "pending" as const,
    priority: 100,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("production_tickets")
    .insert(ticketInserts)
    .select("id, menu_item_id, status, production_date");

  if (insertError) {
    return { ok: false, error: `Error al generar tickets: ${insertError.message}` };
  }

  await supabase.from("orders").update({ status: "in_production" }).eq("id", orderId);

  await createOrderEvent({
    orderId,
    eventType: "confirmed",
    actorId: currentUser.id,
    actorRole: "admin",
    payload: { action: "sent_to_production", tickets_generated: inserted?.length ?? 0 },
  });

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/operador");
  revalidatePath("/operador/produccion");

  return {
    ok: true,
    data: { tickets: inserted ?? [], count: inserted?.length ?? 0 },
  };
}
