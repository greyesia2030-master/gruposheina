"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-user";
import { transitionOrder } from "@/lib/orders/state-machine";
import { isWithinCutoff } from "@/lib/orders/cutoff";
import { createOrderEvent } from "@/lib/orders/events";
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
