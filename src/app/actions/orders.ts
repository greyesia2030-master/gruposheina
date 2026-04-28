"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, format, parseISO } from "date-fns";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-user";
import { transitionOrder } from "@/lib/orders/state-machine";
import { isWithinCutoff } from "@/lib/orders/cutoff";
import { createOrderEvent } from "@/lib/orders/events";
import { insertPlaceholders } from "@/lib/orders/placeholders";
import { registerMovement } from "@/lib/inventory/movements";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send-message";
import { createOrderFormToken } from "@/app/actions/order-form-tokens";
import type { OrderStatus } from "@/lib/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

async function handleAuth() {
  try {
    const user = await requireAdmin();
    return { ok: true as const, user };
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    return fail("Error de autenticación");
  }
}

// ============================================================================
// transitionOrderStatus — wrapper sobre state-machine.transitionOrder
// ============================================================================

const ORDER_STATUSES = [
  "draft",
  "confirmed",
  "in_production",
  "delivered",
  "cancelled",
  "partially_filled",
  "awaiting_confirmation",
] as const satisfies readonly OrderStatus[];

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  newStatus: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

export async function transitionOrderStatus(
  input: z.input<typeof transitionSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  // Si es cancelación de un pedido confirmado, validar ventana de corte
  // server-side (el chequeo en el cliente no es confiable).
  if (data.newStatus === "cancelled") {
    const supabase = await createSupabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("status, menu_id, organization_id, menu:weekly_menus(week_start)")
      .eq("id", data.orderId)
      .single();

    if (order && order.status === "confirmed" && order.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("cutoff_time, cutoff_days_before, timezone")
        .eq("id", order.organization_id)
        .single();

      const menuRow = (order.menu as unknown as { week_start: string } | null) ?? null;
      if (org && !isWithinCutoff(order, menuRow, org)) {
        await createOrderEvent({
          orderId: data.orderId,
          eventType: "override",
          actorId: auth.user.id,
          actorRole: "admin",
          isPostCutoff: true,
          payload: {
            reason: data.reason ?? null,
            from_status: order.status,
            to_status: "cancelled",
          },
        });
      }
    }
  }

  try {
    await transitionOrder(
      data.orderId,
      data.newStatus,
      auth.user.id,
      "admin",
      data.reason
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar";
    return fail(message);
  }

  // Descuento de inventario al pasar a producción
  if (data.newStatus === "in_production") {
    const issues = await consumeInventoryForOrder(data.orderId, auth.user.id);
    if (issues.length > 0) {
      console.error("[INVENTORY] in_production — fallo parcial:", issues);
    }
  }

  // También disparar si pasa directo a entregado sin haber pasado por in_production
  if (data.newStatus === "delivered") {
    const supabase = await createSupabaseAdmin();
    const { count } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("reference_id", data.orderId)
      .eq("reference_type", "order");
    if ((count ?? 0) === 0) {
      const issues = await consumeInventoryForOrder(data.orderId, auth.user.id);
      if (issues.length > 0) {
        console.error("[INVENTORY] delivered fallback — fallo parcial:", issues);
      }
    }
  }

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${data.orderId}`);
  return ok(undefined);
}

// ============================================================================
// updateOrderLines — edita cantidades y recalcula total_units atómicamente
// ============================================================================

const updateLinesSchema = z.object({
  orderId: z.string().uuid(),
  changes: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        quantity: z.coerce.number().int().min(0),
      })
    )
    .min(1, "No hay cambios"),
  reason: z.string().trim().max(1000).optional(),
});

export async function updateOrderLines(
  input: z.input<typeof updateLinesSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const parsed = updateLinesSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const { orderId, changes, reason } = parsed.data;

  const supabase = await createSupabaseAdmin();

  // Cargar el pedido + menu + organización para decidir si es post-cutoff
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "status, menu_id, organization_id, menu:weekly_menus(week_start), organization:organizations(cutoff_time, cutoff_days_before, timezone)"
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) return fail("Pedido no encontrado");

  // Solo pedidos activos pueden editarse
  if (order.status === "cancelled" || order.status === "delivered") {
    return fail("No se puede editar un pedido en este estado");
  }

  const menuRow =
    (order.menu as unknown as { week_start: string } | null) ?? null;
  const orgRow =
    (order.organization as unknown as {
      cutoff_time: string;
      cutoff_days_before: number;
      timezone: string;
    } | null) ?? null;

  const postCutoff = orgRow ? !isWithinCutoff(order, menuRow, orgRow) : false;
  if (postCutoff && !reason?.trim()) {
    return fail("Motivo obligatorio para modificaciones post-corte");
  }

  // Cargar snapshots de las líneas a modificar para auditoría
  const lineIds = changes.map((c) => c.lineId);
  const { data: originalLines } = await supabase
    .from("order_lines")
    .select("id, quantity, option_code, department, order_id")
    .in("id", lineIds);

  if (!originalLines || originalLines.length !== lineIds.length) {
    return fail("Algunas líneas no existen");
  }
  if (originalLines.some((l) => l.order_id !== orderId)) {
    return fail("Las líneas no corresponden al pedido");
  }

  // Aplicar updates línea por línea (Supabase no soporta UPDATE batch con
  // distintos valores en una sola llamada)
  for (const change of changes) {
    const { error } = await supabase
      .from("order_lines")
      .update({ quantity: change.quantity })
      .eq("id", change.lineId);
    if (error) return fail("Error al guardar línea");
  }

  // Recalcular total_units sumando TODAS las líneas del pedido
  const { data: allLines } = await supabase
    .from("order_lines")
    .select("quantity")
    .eq("order_id", orderId);

  const newTotal = (allLines ?? []).reduce(
    (sum, l) => sum + (l.quantity ?? 0),
    0
  );

  await supabase
    .from("orders")
    .update({ total_units: newTotal })
    .eq("id", orderId);

  // Evento de auditoría con el actor_role real resuelto desde requireAdmin
  await createOrderEvent({
    orderId,
    eventType: postCutoff ? "override" : "line_modified",
    actorId: auth.user.id,
    actorRole: "admin",
    isPostCutoff: postCutoff,
    payload: {
      changed_lines: originalLines.map((l) => {
        const newQty = changes.find((c) => c.lineId === l.id)?.quantity ?? l.quantity;
        return {
          id: l.id,
          option_code: l.option_code,
          department: l.department,
          old_qty: l.quantity,
          new_qty: newQty,
        };
      }),
      ...(postCutoff && reason ? { reason } : {}),
    },
  });

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  return ok(undefined);
}

// ============================================================================
// consumeInventoryForOrder — descuenta insumos al pasar un pedido a producción
// ============================================================================

async function consumeInventoryForOrder(orderId: string, actorId: string): Promise<string[]> {
  const issues: string[] = [];
  const supabase = await createSupabaseAdmin();

  // 1. Obtener pedido con menu_id
  const { data: order } = await supabase
    .from("orders")
    .select("menu_id, organization_id")
    .eq("id", orderId)
    .single();
  if (!order?.menu_id) {
    issues.push(`[INVENTORY] Pedido ${orderId.slice(0, 8)} no tiene menu_id — sin recetas que cruzar`);
    return issues;
  }

  // 2. Obtener todas las líneas del pedido, sumar cantidades por (option_code, day_of_week)
  const { data: lines } = await supabase
    .from("order_lines")
    .select("option_code, day_of_week, quantity")
    .eq("order_id", orderId);
  if (!lines || lines.length === 0) {
    issues.push(`[INVENTORY] Pedido ${orderId.slice(0, 8)} no tiene líneas`);
    return issues;
  }

  // Agrupar: { "A_1": 35, "B_1": 28, ... }
  const totalsPerOption: Record<string, number> = {};
  for (const line of lines) {
    const key = `${line.option_code}_${line.day_of_week}`;
    totalsPerOption[key] = (totalsPerOption[key] ?? 0) + (line.quantity ?? 0);
  }

  // 3. Para cada opción, obtener recipe_version_id desde menu_items
  const uniqueOptions = Object.entries(totalsPerOption).filter(([, qty]) => qty > 0);
  if (uniqueOptions.length === 0) {
    issues.push(`[INVENTORY] Todas las líneas del pedido tienen cantidad 0`);
    return issues;
  }

  // Map: option_code+day → recipe_version_id
  const recipeVersionMap: Record<string, string> = {};
  for (const [key] of uniqueOptions) {
    const [optCode, dayStr] = key.split("_");
    const { data: menuItem } = await supabase
      .from("menu_items")
      .select("recipe_version_id")
      .eq("menu_id", order.menu_id)
      .eq("option_code", optCode)
      .eq("day_of_week", parseInt(dayStr, 10))
      .maybeSingle();
    if (menuItem?.recipe_version_id) {
      recipeVersionMap[key] = menuItem.recipe_version_id;
    }
  }

  // 4. Obtener ingredientes para cada recipe_version_id
  const recipeVersionIds = [...new Set(Object.values(recipeVersionMap))];
  if (recipeVersionIds.length === 0) {
    issues.push(`[INVENTORY] Ninguna opción del pedido tiene receta vinculada en el menú`);
    return issues;
  }

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("recipe_version_id, inventory_item_id, quantity")
    .in("recipe_version_id", recipeVersionIds);
  if (!ingredients || ingredients.length === 0) {
    issues.push(`[INVENTORY] Las recetas vinculadas no tienen ingredientes configurados`);
    return issues;
  }

  // 5. Calcular total por insumo: suma de (qty_por_receta × porciones_producidas)
  const consumptionMap: Record<string, number> = {}; // inventory_item_id → total qty

  for (const [key, totalUnits] of uniqueOptions) {
    const rvId = recipeVersionMap[key];
    if (!rvId) continue;
    const recipeIngredients = ingredients.filter((i) => i.recipe_version_id === rvId);
    for (const ing of recipeIngredients) {
      const needed = ing.quantity * totalUnits;
      consumptionMap[ing.inventory_item_id] = (consumptionMap[ing.inventory_item_id] ?? 0) + needed;
    }
  }

  // 6. Registrar movimientos de production_consumption (atómicos via RPC)
  const errors: string[] = [];
  for (const [itemId, totalQty] of Object.entries(consumptionMap)) {
    if (totalQty <= 0) continue;
    try {
      await registerMovement({
        itemId,
        movementType: "production_consumption",
        quantity: totalQty,
        actorId,
        referenceType: "order",
        referenceId: orderId,
        reason: `Producción pedido ${orderId.slice(0, 8)}`,
      });
    } catch (err) {
      errors.push(`${itemId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length > 0) {
    console.error("[INVENTORY] Fallo parcial al consumir stock:", errors);
    issues.push(...errors);
  }

  return issues;
}

// ============================================================================
// retryInventoryConsumption — remediación manual para admin
// ============================================================================

export async function retryInventoryConsumption(
  orderId: string
): Promise<{ ok: true; consumed: number } | { ok: false; error: string }> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseAdmin();

  // Solo pedidos en producción o entregados
  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "Pedido no encontrado" };
  if (!["in_production", "delivered"].includes(order.status)) {
    return { ok: false, error: "Solo se puede recalcular pedidos en producción o entregados" };
  }

  // Verificar si ya hay movimientos para este pedido
  const { count: existingCount } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", orderId)
    .eq("reference_type", "order");

  if ((existingCount ?? 0) > 0) {
    return { ok: false, error: `Ya existen ${existingCount} movimientos para este pedido` };
  }

  const issues = await consumeInventoryForOrder(orderId, auth.user.id);
  if (issues.length > 0) {
    return { ok: false, error: issues.join(" | ") };
  }

  // Count created movements
  const { count: newCount } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", orderId)
    .eq("reference_type", "order");

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/inventario");
  return { ok: true, consumed: newCount ?? 0 };
}

// ============================================================================
// checkStockForOrder — validación de stock antes de pasar a producción
// ============================================================================

export interface StockShortage {
  inventoryItemId: string;
  name: string;
  unit: string;
  needed: number;
  available: number;
  deficit: number;
}

export interface StockCheckResult {
  canProduce: boolean;
  shortages: StockShortage[];
  checkedItems: number;
}

export async function checkStockForOrder(orderId: string): Promise<StockCheckResult> {
  const empty: StockCheckResult = { canProduce: true, shortages: [], checkedItems: 0 };
  const supabase = await createSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("menu_id")
    .eq("id", orderId)
    .single();
  if (!order?.menu_id) return empty;

  const { data: lines } = await supabase
    .from("order_lines")
    .select("option_code, day_of_week, quantity")
    .eq("order_id", orderId);
  if (!lines || lines.length === 0) return empty;

  // Aggregate quantities per (option_code, day_of_week)
  const totalsPerOption: Record<string, number> = {};
  for (const line of lines) {
    const key = `${line.option_code}_${line.day_of_week}`;
    totalsPerOption[key] = (totalsPerOption[key] ?? 0) + (line.quantity ?? 0);
  }

  const uniqueOptions = Object.entries(totalsPerOption).filter(([, qty]) => qty > 0);
  if (uniqueOptions.length === 0) return empty;

  // Get recipe_version_id per option from menu_items
  const recipeVersionMap: Record<string, string> = {};
  for (const [key] of uniqueOptions) {
    const [optCode, dayStr] = key.split("_");
    const { data: menuItem } = await supabase
      .from("menu_items")
      .select("recipe_version_id")
      .eq("menu_id", order.menu_id)
      .eq("option_code", optCode)
      .eq("day_of_week", parseInt(dayStr, 10))
      .maybeSingle();
    if (menuItem?.recipe_version_id) recipeVersionMap[key] = menuItem.recipe_version_id;
  }

  const recipeVersionIds = [...new Set(Object.values(recipeVersionMap))];
  if (recipeVersionIds.length === 0) return empty;

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("recipe_version_id, inventory_item_id, quantity")
    .in("recipe_version_id", recipeVersionIds);
  if (!ingredients || ingredients.length === 0) return empty;

  // Calculate total needed per inventory item
  const neededMap: Record<string, number> = {};
  for (const [key, totalUnits] of uniqueOptions) {
    const rvId = recipeVersionMap[key];
    if (!rvId) continue;
    for (const ing of ingredients.filter((i) => i.recipe_version_id === rvId)) {
      neededMap[ing.inventory_item_id] = (neededMap[ing.inventory_item_id] ?? 0) + ing.quantity * totalUnits;
    }
  }

  const itemIds = Object.keys(neededMap);
  if (itemIds.length === 0) return empty;

  const { data: items } = await supabase
    .from("inventory_items")
    .select("id, name, unit, current_stock")
    .in("id", itemIds);

  const shortages: StockShortage[] = [];
  for (const item of items ?? []) {
    const needed = neededMap[item.id] ?? 0;
    if (needed > (item.current_stock ?? 0)) {
      shortages.push({
        inventoryItemId: item.id,
        name: item.name,
        unit: item.unit,
        needed,
        available: item.current_stock ?? 0,
        deficit: needed - (item.current_stock ?? 0),
      });
    }
  }

  return { canProduce: shortages.length === 0, shortages, checkedItems: itemIds.length };
}

// ============================================================================
// sendReminderToClient — WhatsApp recordatorio para pedidos en borrador
// ============================================================================

export async function sendReminderToClient(orderId: string): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("week_label, total_units, status, organization_id")
    .eq("id", orderId)
    .single();
  if (!order) return fail("Pedido no encontrado");
  if (order.status !== "draft") return fail("Solo se puede enviar recordatorio a pedidos en borrador");

  const { data: org } = await supabase
    .from("organizations")
    .select("contact_phone, authorized_phones")
    .eq("id", order.organization_id)
    .single();

  const phones = org?.authorized_phones as string[] | null;
  const phone = org?.contact_phone ?? phones?.[0] ?? null;
  if (!phone) return fail("La organización no tiene teléfono de contacto registrado");

  const message =
    `⏰ *Recordatorio de Grupo Sheina:* Tenés un pedido pendiente de confirmar ` +
    `para *${order.week_label}* (${order.total_units} viandas).\n\n` +
    `Respondé *confirmo* para confirmarlo o *cancelar* para anularlo.`;

  try {
    await sendWhatsAppMessage(phone, message);
    await createOrderEvent({
      orderId,
      eventType: "override",
      actorId: auth.user.id,
      actorRole: "admin",
      payload: { action: "reminder_sent", phone },
    });
    revalidatePath(`/pedidos/${orderId}`);
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Error enviando recordatorio");
  }
}

// ============================================================================
// applyAdminOverride — edición admin del consolidado (D.6)
// ============================================================================

const overrideSchema = z.object({
  orderId:    z.string().uuid(),
  dayOfWeek:  z.number().int().min(1).max(5),
  optionCode: z.string().min(1).max(10),
  newTotal:   z.number().int().min(0),
  reason:     z.string().trim().min(1, "Razón obligatoria").max(500),
});

export async function applyAdminOverride(
  input: z.input<typeof overrideSchema>
): Promise<ActionResult<{ delta: number; newLineId: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;
  if (!["superadmin", "admin"].includes(auth.user.role)) {
    return fail("Se requiere rol de administrador");
  }

  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { orderId, dayOfWeek, optionCode, newTotal, reason } = parsed.data;

  const supabase = await createSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (!order) return fail("Pedido no encontrado");
  if (["delivered", "cancelled"].includes(order.status)) {
    return fail("No se puede modificar un pedido entregado o cancelado");
  }

  const { data: existingLines } = await supabase
    .from("order_lines")
    .select("id, quantity, unit_price, display_name, menu_item_id, section_id, department, participant_id")
    .eq("order_id", orderId)
    .eq("day_of_week", dayOfWeek)
    .eq("option_code", optionCode);

  const currentTotal = (existingLines ?? []).reduce((s, l) => s + (l.quantity ?? 0), 0);
  const delta = newTotal - currentTotal;
  if (delta === 0) return fail("El total no cambió");

  const template = existingLines?.find((l) => l.participant_id !== null) ?? existingLines?.[0];
  if (!template) return fail("No hay líneas previas para esta opción");

  const { data: inserted, error: insErr } = await supabase
    .from("order_lines")
    .insert({
      order_id:            orderId,
      day_of_week:         dayOfWeek,
      option_code:         optionCode,
      display_name:        template.display_name,
      department:          template.department,
      quantity:            delta,
      unit_price:          template.unit_price,
      participant_id:      null,
      section_id:          null,
      menu_item_id:        template.menu_item_id,
      is_admin_override:   true,
      admin_override_by:   auth.user.id,
      admin_override_reason: reason,
      admin_override_at:   new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return fail(insErr.message);

  await createOrderEvent({
    orderId,
    eventType: "override",
    actorId:   auth.user.id,
    actorRole: "admin",
    payload: {
      day_of_week:     dayOfWeek,
      option_code:     optionCode,
      previous_total:  currentTotal,
      new_total:       newTotal,
      delta,
      reason,
      override_line_id: inserted.id,
    },
  });

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/");

  return ok({ delta, newLineId: inserted.id });
}

// ============================================================================
// setOrderCutoff — sobreescribe el corte de un pedido específico (E.2)
// SQL migration required: ALTER TABLE orders ADD COLUMN custom_cutoff_at TIMESTAMPTZ;
// ============================================================================

const cutoffSchema = z.object({
  orderId:  z.string().uuid(),
  cutoffAt: z.string().datetime({ offset: true }),
});

export async function setOrderCutoff(
  input: z.input<typeof cutoffSchema>
): Promise<ActionResult> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;
  if (!["superadmin", "admin"].includes(auth.user.role)) {
    return fail("Se requiere rol de administrador");
  }

  const parsed = cutoffSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { orderId, cutoffAt } = parsed.data;

  const supabase = await createSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .update({ custom_cutoff_at: cutoffAt } as Record<string, unknown>)
    .eq("id", orderId);

  if (error) return fail(error.message);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  return ok(undefined);
}

// ============================================================================
// markProductionComplete — operador confirma producción y consume insumos (E.4/E.5)
// ============================================================================

export async function markProductionComplete(
  orderId: string
): Promise<ActionResult<{ consumed: number }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (!order) return fail("Pedido no encontrado");
  if (order.status !== "in_production") {
    return fail("Solo se pueden completar pedidos con estado 'en producción'");
  }

  const { count: existing } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", orderId)
    .eq("reference_type", "order");

  if ((existing ?? 0) > 0) {
    return fail(`Ya existen ${existing} movimientos de consumo para este pedido`);
  }

  const issues = await consumeInventoryForOrder(orderId, auth.user.id);

  const { count: newCount } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", orderId)
    .eq("reference_type", "order");

  await createOrderEvent({
    orderId,
    eventType: "override",
    actorId: auth.user.id,
    actorRole: "admin",
    payload: {
      action: "production_complete",
      consumed_movements: newCount ?? 0,
      issues: issues.length > 0 ? issues : undefined,
    },
  });

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/operador/produccion");
  revalidatePath("/inventario");

  if (issues.length > 0) {
    return fail(`Producción completada con advertencias: ${issues.slice(0, 3).join(" | ")}`);
  }
  return ok({ consumed: newCount ?? 0 });
}

// ============================================================================
// getOrgsAndMenusForModal — datos para el modal de crear pedido manual (E.7)
// ============================================================================

export async function getOrgsAndMenusForModal(): Promise<
  ActionResult<{
    orgs: { id: string; name: string }[];
    menus: { id: string; week_label: string; week_start: string }[];
  }>
> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseAdmin();

  const [{ data: orgs }, { data: menus }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("weekly_menus")
      .select("id, week_start, week_end")
      .eq("status", "published")
      .order("week_start", { ascending: false })
      .limit(10),
  ]);

  return ok({
    orgs: (orgs ?? []) as { id: string; name: string }[],
    menus: (menus ?? []).map((m) => ({
      id: m.id,
      week_label: `${format(parseISO(m.week_start), "d/M")} al ${format(parseISO(m.week_end), "d/M")}`,
      week_start: m.week_start,
    })),
  });
}

// ============================================================================
// createManualOrder — crea pedido + token desde el dashboard admin (E.7)
// ============================================================================

const createManualOrderSchema = z.object({
  organizationId: z.string().uuid(),
  menuId: z.string().uuid(),
  departmentIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function createManualOrder(
  input: z.input<typeof createManualOrderSchema>
): Promise<ActionResult<{ orderId: string; token: string }>> {
  const auth = await handleAuth();
  if (!auth.ok) return auth;
  if (!["superadmin", "admin"].includes(auth.user.role)) {
    return fail("Se requiere rol de administrador");
  }

  const parsed = createManualOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { organizationId, menuId, departmentIds } = parsed.data;

  const supabase = await createSupabaseAdmin();

  const [{ data: org }, { data: menu }] = await Promise.all([
    supabase.from("organizations").select("id, status").eq("id", organizationId).single(),
    supabase
      .from("weekly_menus")
      .select("id, week_start, week_end, status")
      .eq("id", menuId)
      .single(),
  ]);

  if (!org) return fail("Organización no encontrada");
  if ((org as { status: string }).status !== "active") return fail("La organización no está activa");
  if (!menu) return fail("Menú no encontrado");
  if ((menu as { status: string }).status !== "published") return fail("El menú debe estar publicado");

  // Fetch departments (validates they belong to the org)
  const { data: depts } = await supabase
    .from("client_departments")
    .select("id, name, expected_participants")
    .in("id", departmentIds)
    .eq("organization_id", organizationId)
    .order("name");

  if (!depts || depts.length === 0) return fail("No se encontraron sectores para esta organización");

  const m = menu as { week_start: string; week_end: string };
  const weekLabel = `${format(parseISO(m.week_start), "d/M")} al ${format(parseISO(m.week_end), "d/M")}`;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: organizationId,
      menu_id: menuId,
      week_label: weekLabel,
      status: "draft",
      source: "web_form",
      total_units: 0,
      total_amount: 0,
    })
    .select("id")
    .single();

  if (orderError || !order) return fail("Error al crear el pedido");

  // INSERT order_sections with client_department_id
  const sectionInserts = (depts as unknown as { id: string; name: string; expected_participants: number | null }[]).map((d, i) => ({
    order_id: order.id,
    name: d.name,
    display_order: i,
    client_department_id: d.id,
    expected_participants: d.expected_participants ?? 0,
    total_quantity: 0,
  }));

  const { data: insertedSections, error: sectionsError } = await supabase
    .from("order_sections")
    .insert(sectionInserts)
    .select("id, client_department_id");

  if (sectionsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return fail("Error al crear secciones");
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

  // INSERT form token (sections already created, skip sectionNames)
  const tokenResult = await createOrderFormToken({
    organizationId,
    menuId,
    orderId: order.id,
    validUntil: addDays(new Date(), 7),
  });

  if (!tokenResult.ok) {
    await supabase.from("order_sections").delete().eq("order_id", order.id);
    await supabase.from("orders").delete().eq("id", order.id);
    return fail(tokenResult.error);
  }

  // Link token to order
  const tokenData = tokenResult.data as unknown as { id: string; token: string };
  await supabase.from("orders").update({ form_token_id: tokenData.id }).eq("id", order.id);

  revalidatePath("/pedidos");
  return ok({
    orderId: order.id,
    token: tokenData.token,
  });
}

