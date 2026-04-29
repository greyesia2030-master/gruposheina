"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { createOrderEvent } from "@/lib/orders/events";
import { canBeConfirmedDelivered } from "@/lib/orders/invariants";
import type { UserRole, OrderStatus } from "@/lib/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALLOWED_ROLES: readonly UserRole[] = ["superadmin", "admin", "operator"];

export async function confirmDelivery(orderId: string): Promise<ActionResult> {
  const supabase = await createSupabaseAdmin();

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Error de autenticación" };
  }

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    return { ok: false, error: "No autorizado para confirmar entrega." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido no encontrado" };

  const inv = canBeConfirmedDelivered(order.status as OrderStatus);
  if (!inv.ok) return { ok: false, error: inv.reason };

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      delivered_at: now,
      delivered_by: currentUser.id,
    })
    .eq("id", orderId);

  if (error) return { ok: false, error: `Error al confirmar entrega: ${error.message}` };

  await createOrderEvent({
    orderId,
    eventType: "delivered",
    actorId: currentUser.id,
    actorRole: "admin",
    payload: { newStatus: "delivered" },
  });

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath(`/mi-portal/pedidos/${orderId}`);
  revalidatePath("/mi-portal/pedidos");

  return { ok: true, data: undefined };
}
