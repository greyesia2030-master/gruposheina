import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { formatART } from "@/lib/utils/timezone";
import type { ProductionTicketStatus } from "@/lib/types/database";
import { TicketStartButton } from "./ticket-start-button";
import { TicketCompleteModal } from "./ticket-complete-modal";
import { PartialWasteForm } from "./partial-waste-form";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes",
};

const STATUS_LABELS: Record<ProductionTicketStatus, string> = {
  pending:     "Pendiente",
  in_progress: "En producción",
  paused:      "Pausado",
  ready:       "Listo",
  blocked:     "Bloqueado",
  cancelled:   "Cancelado",
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = await params;
  const currentUser = await requireUser();
  const supabase = await createSupabaseServer();
  const db = await createSupabaseAdmin();

  const { data: ticket } = await supabase
    .from("production_tickets")
    .select(
      "id, status, quantity_target, quantity_produced, quantity_wasted, production_date, started_at, ready_at, blocked_reason, recipe_version_id, assigned_cook_id, order:orders(id, week_label, organization:organizations(name))"
    )
    .eq("id", ticketId)
    .single();

  if (!ticket) notFound();

  const menuItemRes = await supabase
    .from("production_tickets")
    .select("menu_item:menu_items(id, display_name, option_code, day_of_week)")
    .eq("id", ticketId)
    .single();

  const menuItem = menuItemRes.data?.menu_item as unknown as {
    id: string;
    display_name: string;
    option_code: string;
    day_of_week: number;
  } | null;

  const order = ticket.order as unknown as {
    id: string;
    week_label: string;
    organization: { name: string } | null;
  } | null;

  const status = ticket.status as ProductionTicketStatus;

  // Recipe info
  type Ingredient = {
    id: string;
    inventory_item_id: string;
    quantity: number;
    unit: string;
    ingredient_name: string;
    current_stock: number;
    item_unit: string;
  };

  let ingredients: Ingredient[] = [];
  let portionsYield = 1;
  let costPerPortion = 0;
  let factor = 1;

  if (ticket.recipe_version_id) {
    const [rvRes, ingRes] = await Promise.all([
      db
        .from("recipe_versions")
        .select("portions_yield, cost_per_portion")
        .eq("id", ticket.recipe_version_id)
        .single(),
      db
        .from("recipe_ingredients")
        .select(
          "id, inventory_item_id, quantity, unit, inventory_item:inventory_items(id, name, unit, current_stock)"
        )
        .eq("recipe_version_id", ticket.recipe_version_id),
    ]);

    portionsYield = (rvRes.data?.portions_yield as number) || 1;
    costPerPortion = (rvRes.data?.cost_per_portion as number) || 0;
    factor = ((ticket.quantity_target as number) || 0) / portionsYield;

    ingredients = (ingRes.data ?? []).map((ing) => {
      const item = ing.inventory_item as unknown as {
        id: string;
        name: string;
        unit: string;
        current_stock: number;
      } | null;
      return {
        id: ing.id as string,
        inventory_item_id: ing.inventory_item_id as string,
        quantity: (ing.quantity as number) || 0,
        unit: ing.unit as string,
        ingredient_name: item?.name ?? "—",
        current_stock: item?.current_stock ?? 0,
        item_unit: item?.unit ?? "",
      };
    });
  }

  // Consumed lots (if in_progress or ready)
  type ConsumedLot = {
    id: string;
    lot_id: string;
    lot_code: string | null;
    quantity_consumed: number;
    unit: string;
    item_name: string;
  };
  let consumedLots: ConsumedLot[] = [];

  if (["in_progress", "ready"].includes(status)) {
    const { data: consumptions } = await db
      .from("production_lot_consumption")
      .select(
        "id, lot_id, quantity_consumed, unit, lot:inventory_lots(lot_code, item:inventory_items(name))"
      )
      .eq("ticket_id", ticketId);

    consumedLots = (consumptions ?? []).map((c) => {
      const lot = c.lot as unknown as {
        lot_code: string | null;
        item: { name: string } | null;
      } | null;
      return {
        id: c.id as string,
        lot_id: c.lot_id as string,
        lot_code: lot?.lot_code ?? null,
        quantity_consumed: (c.quantity_consumed as number) || 0,
        unit: c.unit as string,
        item_name: lot?.item?.name ?? "—",
      };
    });
  }

  // Partial wastes
  type PartialWaste = {
    id: string;
    item_name: string;
    item_unit: string;
    quantity: number;
    reason: string | null;
    created_at: string;
  };
  let partialWastes: PartialWaste[] = [];

  if (["in_progress", "ready"].includes(status)) {
    const { data: wastes } = await db
      .from("inventory_movements")
      .select("id, quantity, reason, created_at, item:inventory_items(name, unit)")
      .eq("reference_id", ticketId)
      .eq("reference_type", "production_ticket")
      .eq("movement_type", "waste_approved");

    partialWastes = (wastes ?? []).map((w) => {
      const item = w.item as unknown as { name: string; unit: string } | null;
      return {
        id: w.id as string,
        item_name: item?.name ?? "—",
        item_unit: item?.unit ?? "",
        quantity: (w.quantity as number) || 0,
        reason: w.reason as string | null,
        created_at: w.created_at as string,
      };
    });
  }

  const isAdmin = ["admin", "superadmin"].includes(currentUser.role);
  const canStart = ["pending", "paused"].includes(status);
  const canComplete = status === "in_progress";
  const totalCost = costPerPortion * ((ticket.quantity_target as number) || 0);

  return (
    <div className="max-w-xl">
      <Link
        href="/operador/produccion"
        className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Producción
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
            {ticket.production_date
              ? formatART(
                  (ticket.production_date as string) + "T12:00:00",
                  "EEEE d/M"
                )
              : "—"}
          </p>
          <h1 className="text-2xl font-heading font-light text-stone-900">
            {menuItem?.display_name ?? "Ticket de producción"}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {order?.organization?.name ?? "—"} · {order?.week_label ?? "—"}
          </p>
        </div>
        <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 mt-1 flex-shrink-0">
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="p-3 text-center">
            <p className="text-xs text-stone-400 mb-0.5">Objetivo</p>
            <p className="text-xl font-bold text-stone-900">
              {ticket.quantity_target as number}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-3 text-center">
            <p className="text-xs text-stone-400 mb-0.5">Producido</p>
            <p className="text-xl font-bold text-stone-900">
              {(ticket.quantity_produced as number) > 0
                ? (ticket.quantity_produced as number)
                : "—"}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-3 text-center">
            <p className="text-xs text-stone-400 mb-0.5">Mermas</p>
            <p className="text-xl font-bold text-stone-900">
              {(ticket.quantity_wasted as number) > 0
                ? (ticket.quantity_wasted as number)
                : "—"}
            </p>
          </div>
        </Card>
      </div>

      {/* Recipe section */}
      {ticket.recipe_version_id ? (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-1">
            Ingredientes necesarios
          </h2>
          <p className="text-xs text-stone-400 mb-2">
            Para este ticket ({ticket.quantity_target as number} viandas ·{" "}
            {Math.ceil(factor * 10) / 10} × batch de {portionsYield} porciones) · Costo estimado:{" "}
            ${totalCost.toLocaleString("es-AR")}
          </p>
          <Card>
            <div className="divide-y divide-stone-100">
              {ingredients.map((ing) => {
                const needed = ing.quantity * factor;
                const hasEnough = ing.current_stock >= needed;
                return (
                  <div key={ing.id} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-stone-800 text-sm">
                        {ing.ingredient_name}
                      </p>
                      <p className="text-sm font-semibold text-stone-900">
                        {needed.toFixed(2)} {ing.unit}
                      </p>
                    </div>
                    <p
                      className={`text-xs mt-0.5 ${
                        hasEnough ? "text-stone-400" : "text-red-500 font-medium"
                      }`}
                    >
                      Stock actual: {ing.current_stock} {ing.item_unit}
                      {!hasEnough && " ⚠ stock insuficiente"}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : (
        <div className="mb-6 bg-stone-50 border border-stone-200 rounded-xl p-4">
          <p className="text-xs text-stone-500">
            Este ítem no tiene receta vinculada. El descuento de inventario se
            omite y debe registrarse manualmente si aplica.
          </p>
        </div>
      )}

      {/* Consumed lots (in_progress or ready) */}
      {consumedLots.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Inventario consumido
          </h2>
          <Card>
            <div className="divide-y divide-stone-100">
              {consumedLots.map((c) => (
                <div key={c.id} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-stone-700">
                    {c.item_name}
                    {c.lot_code && (
                      <span className="text-xs text-stone-400 ml-1">
                        ({c.lot_code})
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-stone-900">
                    {c.quantity_consumed.toFixed(3)} {c.unit}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Partial waste section (in_progress) */}
      {canComplete && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Registrar merma parcial
          </h2>
          <PartialWasteForm
            ticketId={ticketId}
            items={ingredients.map((i) => ({
              id: i.inventory_item_id,
              name: i.ingredient_name,
              unit: i.item_unit,
            }))}
          />
          {partialWastes.length > 0 && (
            <div className="mt-3 space-y-1">
              {partialWastes.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 text-xs text-stone-500"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span>
                    {w.item_name}: {w.quantity} {w.item_unit}
                    {w.reason && ` · "${w.reason}"`}
                    · {formatART(w.created_at, "HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {canStart && (
          <TicketStartButton ticketId={ticketId} isAdmin={isAdmin} />
        )}
        {canComplete && (
          <TicketCompleteModal
            ticketId={ticketId}
            quantityTarget={(ticket.quantity_target as number) || 0}
          />
        )}
      </div>

      {ticket.blocked_reason && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 mb-1">Motivo de bloqueo</p>
          <p className="text-sm text-red-800">{ticket.blocked_reason as string}</p>
        </div>
      )}
    </div>
  );
}
