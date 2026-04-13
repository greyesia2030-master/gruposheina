"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-user";
import { transitionOrder } from "@/lib/orders/state-machine";
import { isWithinCutoff } from "@/lib/orders/cutoff";
import { createOrderEvent } from "@/lib/orders/events";
import { registerMovement } from "@/lib/inventory/movements";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send-message";
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
        .select("cutoff_time, cutoff_days_before")
        .eq("id", order.organization_id)
        .single();

      const menuRow = (order.menu as unknown as { week_start: string }[] | null)?.[0] ?? null;
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
      "status, menu_id, organization_id, menu:weekly_menus(week_start), organization:organizations(cutoff_time, cutoff_days_before)"
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) return fail("Pedido no encontrado");

  // Solo pedidos activos pueden editarse
  if (order.status === "cancelled" || order.status === "delivered") {
    return fail("No se puede editar un pedido en este estado");
  }

  const menuRow =
    (order.menu as unknown as { week_start: string }[] | null)?.[0] ?? null;
  const orgRow =
    (order.organization as unknown as {
      cutoff_time: string;
      cutoff_days_before: number;
    }[] | null)?.[0] ?? null;

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
