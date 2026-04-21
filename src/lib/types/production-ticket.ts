import type { ProductionTicket, ProductionTicketStatus } from "./database";

export interface ProductionTicketWithRelations extends ProductionTicket {
  menu_item_name: string;
  order_week_label: string;
  cook_name: string | null;
  site_name: string | null;
}

export const TICKET_STATUS_LABELS: Record<ProductionTicketStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  paused: "Pausado",
  ready: "Listo",
  blocked: "Bloqueado",
  cancelled: "Cancelado",
};

export const TICKET_STATUS_COLORS: Record<ProductionTicketStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  ready: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};
