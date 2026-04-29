import type { OrderStatus } from "@/lib/types/database";

const VARIANT_STYLES: Record<string, string> = {
  default:       "bg-gray-100 text-gray-700",
  info:          "bg-blue-100 text-blue-700",
  success:       "bg-green-100 text-green-700",
  warning:       "bg-amber-100 text-amber-700",
  danger:        "bg-red-100 text-red-700",
  primary:       "bg-primary/10 text-primary",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof VARIANT_STYLES;
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// ── Badge tipado para estados de pedido ───────────────────────────────────────

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  draft:                  "bg-gray-100 text-gray-700",
  confirmed:              "bg-blue-100 text-blue-700",
  in_production:          "bg-amber-100 text-amber-800",
  ready_for_delivery:     "bg-amber-100 text-amber-800",
  out_for_delivery:       "bg-blue-100 text-blue-700",
  delivered:              "bg-green-100 text-green-700",
  cancelled:              "bg-red-100 text-red-700",
  partially_filled:       "bg-yellow-100 text-yellow-800",
  awaiting_confirmation:  "bg-purple-100 text-purple-700",
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft:                  "Borrador",
  confirmed:              "Confirmado",
  in_production:          "En cocina",
  ready_for_delivery:     "Listo · Coordinando entrega",
  out_for_delivery:       "En camino",
  delivered:              "Entregado",
  cancelled:              "Cancelado",
  partially_filled:       "Cargando",
  awaiting_confirmation:  "Pendiente confirmación",
};

export function OrderStatusBadge({
  status,
  className = "",
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[status]} ${className}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
