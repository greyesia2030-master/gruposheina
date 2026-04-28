import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { formatART } from "@/lib/utils/timezone";
import type { ProductionTicketStatus } from "@/lib/types/database";

const DAY_NAMES: Record<string, string> = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
};

const STATUS_CONFIG: Record<
  ProductionTicketStatus,
  { label: string; dot: string; bg: string; border: string }
> = {
  pending:     { label: "Pendiente",     dot: "bg-amber-400",  bg: "bg-amber-50",  border: "border-amber-200" },
  in_progress: { label: "En producción", dot: "bg-blue-500",   bg: "bg-blue-50",   border: "border-blue-200"  },
  paused:      { label: "Pausado",       dot: "bg-stone-400",  bg: "bg-stone-50",  border: "border-stone-200" },
  ready:       { label: "Listo",         dot: "bg-green-500",  bg: "bg-green-50",  border: "border-green-200" },
  blocked:     { label: "Bloqueado",     dot: "bg-red-500",    bg: "bg-red-50",    border: "border-red-200"   },
  cancelled:   { label: "Cancelado",     dot: "bg-stone-300",  bg: "bg-stone-50",  border: "border-stone-100" },
};

export default async function OperadorProduccionPage() {
  await requireUser();
  const supabase = await createSupabaseServer();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const sevenDaysLater = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const { data: tickets } = await supabase
    .from("production_tickets")
    .select(
      "id, status, quantity_target, quantity_produced, quantity_wasted, production_date, started_at, ready_at, menu_item:menu_items(id, display_name, option_code)"
    )
    .not("status", "eq", "cancelled")
    .gte("production_date", sevenDaysAgo)
    .lte("production_date", sevenDaysLater)
    .order("production_date")
    .order("status");

  const allTickets = tickets ?? [];

  // Group by production_date
  const byDate = allTickets.reduce<Record<string, typeof allTickets>>(
    (acc, t) => {
      const d = t.production_date as string;
      (acc[d] ??= []).push(t);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-1">Producción</h1>
      <p className="text-sm text-stone-400 mb-8">
        {formatART(new Date().toISOString(), "EEEE dd MMMM yyyy")}
      </p>

      {sortedDates.length === 0 ? (
        <Card>
          <p className="p-8 text-center text-stone-400 text-sm">
            Sin tickets de producción en este período.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((date) => {
            const dayTickets = byDate[date];
            const pendingCount = dayTickets.filter((t) => t.status === "pending").length;
            const inProgressCount = dayTickets.filter((t) => t.status === "in_progress").length;
            const readyCount = dayTickets.filter((t) => t.status === "ready").length;

            // Get day name from date
            const d = new Date(date + "T12:00:00");
            const dayNum = String(d.getDay() === 0 ? 7 : d.getDay());
            const dayName = DAY_NAMES[dayNum] ?? date;

            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
                    {dayName} {formatART(date + "T12:00:00", "d/M")}
                  </h2>
                  <div className="flex gap-2 text-xs text-stone-400">
                    {pendingCount > 0 && (
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
                      </span>
                    )}
                    {inProgressCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {inProgressCount} en producción
                      </span>
                    )}
                    {readyCount > 0 && (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {readyCount} listo{readyCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {dayTickets.map((ticket) => {
                    const status = ticket.status as ProductionTicketStatus;
                    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
                    const menuItem = ticket.menu_item as unknown as {
                      id: string; display_name: string; option_code: string;
                    } | null;

                    return (
                      <Link key={ticket.id} href={`/operador/produccion/${ticket.id}`}>
                        <Card
                          className={`hover:border-[#D4622B]/40 transition-colors cursor-pointer ${cfg.border}`}
                        >
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`}
                                />
                                <p className="font-medium text-stone-900 truncate text-sm">
                                  {menuItem?.display_name ?? "Sin nombre"}
                                </p>
                              </div>
                              <p className="text-xs text-stone-400 ml-4">
                                {ticket.quantity_target as number} viandas objetivo
                                {ticket.status === "ready" &&
                                  ` · ${ticket.quantity_produced as number} producidas`}
                                {ticket.started_at &&
                                  ticket.status === "in_progress" &&
                                  ` · iniciado ${formatART(ticket.started_at as string, "HH:mm")}`}
                                {ticket.ready_at &&
                                  ticket.status === "ready" &&
                                  ` · listo ${formatART(ticket.ready_at as string, "HH:mm")}`}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${cfg.bg} ${cfg.border} border`}
                            >
                              {cfg.label}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
