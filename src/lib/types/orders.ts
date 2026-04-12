import type {
  Order,
  OrderLine,
  OrderEvent,
  Organization,
  OrderStatus,
  OrderSource,
  PaymentStatus,
} from "./database";

export interface OrderWithRelations extends Order {
  organization: Pick<Organization, "id" | "name">;
  lines: OrderLine[];
  events: OrderEvent[];
}

// Pedido con líneas y organización (vista de detalle)
export interface OrderWithLines extends Order {
  organization: Pick<Organization, "id" | "name" | "departments">;
  lines: OrderLine[];
}

// Evento con nombre del actor resuelto (join con users)
export interface OrderEventWithActor extends OrderEvent {
  actor_name: string | null;
}

// Input para crear un pedido nuevo
export interface CreateOrderInput {
  organization_id: string;
  menu_id: string;
  week_label: string;
  source: OrderSource;
  lines: Array<{
    menu_item_id: string;
    day_of_week: number;
    department: string;
    quantity: number;
    unit_price: number;
    option_code: string;
    display_name: string;
    recipe_version_id?: string | null;
  }>;
  original_file_url?: string | null;
  ai_parsing_log?: Record<string, unknown> | null;
}

// Input para modificar una línea de pedido (ABM)
export interface UpdateOrderLineInput {
  line_id: string;
  quantity?: number;
  department?: string;
  reason?: string; // requerido si es post-corte
}

// Resumen de pedido para la lista (sin líneas)
export interface OrderSummary {
  id: string;
  organization_name: string;
  week_label: string;
  status: OrderStatus;
  source: OrderSource;
  payment_status: PaymentStatus;
  total_units: number;
  total_amount: number;
  confirmed_at: string | null;
  created_at: string;
}

// Resultado del parsing de Excel por Claude
export interface ParsedExcelData {
  week_label: string;
  week_start: string; // YYYY-MM-DD
  week_end: string;
  lines: Array<{
    day_of_week: number; // 1-5
    option_code: string;
    display_name: string;
    category: string;
    quantities_by_department: Record<string, number>;
    total: number;
  }>;
  warnings: string[];
  raw_totals_per_day: Record<number, number>;
}

export interface OrderLinesByDay {
  day: number;
  dayName: string;
  lines: OrderLine[];
  dayTotal: number;
}

export const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  in_production: "En producción",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_production: "bg-amber-100 text-amber-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};
