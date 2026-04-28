"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { createOrderEvent } from "@/lib/orders/events";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

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
