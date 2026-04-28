"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import type { UserRole } from "@/lib/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ConsumptionRecord = {
  inventory_item_id: string;
  ok: boolean;
  fallback: boolean;
  total_cost: number;
};

const ALLOWED_ROLES: readonly UserRole[] = [
  "kitchen",
  "warehouse",
  "operator",
  "admin",
  "superadmin",
];

export async function startProductionTicket(
  ticketId: string
): Promise<ActionResult<{ consumptions: ConsumptionRecord[] }>> {
  const supabase = await createSupabaseAdmin();

  let currentUser;
  try {
    currentUser = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Error de autenticación" };
  }

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    return { ok: false, error: "Tu rol no permite iniciar tickets de producción." };
  }

  const { data: ticket } = await supabase
    .from("production_tickets")
    .select("id, status, recipe_version_id, quantity_target, order_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { ok: false, error: "Ticket no encontrado" };
  if (!["pending", "paused"].includes(ticket.status as string)) {
    return {
      ok: false,
      error: `El ticket no se puede iniciar (estado: ${ticket.status})`,
    };
  }

  const consumptions: ConsumptionRecord[] = [];

  if (ticket.recipe_version_id) {
    const [rvResult, ingResult] = await Promise.all([
      supabase
        .from("recipe_versions")
        .select("portions_yield")
        .eq("id", ticket.recipe_version_id)
        .single(),
      supabase
        .from("recipe_ingredients")
        .select("inventory_item_id, quantity, unit")
        .eq("recipe_version_id", ticket.recipe_version_id),
    ]);

    const rv = rvResult.data;
    const ingredients = ingResult.data ?? [];

    if (rv && ingredients.length > 0) {
      const portionsYield = ((rv.portions_yield as number) || 1);
      const factor = ((ticket.quantity_target as number) || 0) / portionsYield;

      for (const ing of ingredients) {
        const qtyNeeded = ((ing.quantity as number) || 0) * factor;

        try {
          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "consume_inventory_for_production",
            {
              p_item_id: ing.inventory_item_id,
              p_qty_needed: qtyNeeded,
              p_ticket_id: ticketId,
              p_actor_id: currentUser.id,
              p_unit: ing.unit,
            }
          );

          if (rpcError) {
            console.error("RPC consume error:", rpcError.message);
            consumptions.push({
              inventory_item_id: ing.inventory_item_id as string,
              ok: false,
              fallback: false,
              total_cost: 0,
            });
          } else {
            const r = rpcResult as { ok: boolean; fallback: boolean; total_cost: number } | null;
            consumptions.push({
              inventory_item_id: ing.inventory_item_id as string,
              ok: r?.ok ?? true,
              fallback: r?.fallback ?? false,
              total_cost: r?.total_cost ?? 0,
            });
          }
        } catch (err) {
          console.error("Unexpected error consuming inventory:", err);
          consumptions.push({
            inventory_item_id: ing.inventory_item_id as string,
            ok: false,
            fallback: false,
            total_cost: 0,
          });
        }
      }
    }
  }

  await supabase
    .from("production_tickets")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      assigned_cook_id: currentUser.id,
    })
    .eq("id", ticketId);

  revalidatePath("/operador/produccion");
  revalidatePath(`/operador/produccion/${ticketId}`);
  revalidatePath("/operador");
  if (ticket.order_id) {
    revalidatePath(`/pedidos/${ticket.order_id}`);
  }

  return { ok: true, data: { consumptions } };
}
