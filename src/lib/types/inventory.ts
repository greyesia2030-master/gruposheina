import type {
  InventoryItem,
  InventoryMovement,
  InvCategory,
  MovementType,
} from "./database";

export interface InventoryItemWithMovements extends InventoryItem {
  movements: InventoryMovement[];
}

// Item con flag de stock bajo calculado
export interface InventoryItemWithAlerts extends InventoryItem {
  isLowStock: boolean;
  stockPercentage: number; // current_stock / min_stock * 100
}

// Movimiento con nombre del actor resuelto (join con users)
export interface InventoryMovementWithActor extends InventoryMovement {
  actor_name: string | null;
  item_name: string;
  item_unit: string;
}

// Input para registrar un movimiento manual
export interface CreateMovementInput {
  item_id: string;
  movement_type: MovementType;
  quantity: number; // positiva, el tipo define el signo
  unit_cost?: number | null;
  reason?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

// Alerta de stock bajo para dashboard / notificaciones
export interface StockAlert {
  item_id: string;
  item_name: string;
  category: InvCategory;
  current_stock: number;
  min_stock: number;
  unit: string;
  severity: "critical" | "warning"; // critical si stock = 0
}

export const INV_CATEGORY_LABELS: Record<InvCategory, string> = {
  carnes: "Carnes",
  lacteos: "Lácteos",
  verduras: "Verduras",
  secos: "Secos",
  condimentos: "Condimentos",
  envases: "Envases",
  otros: "Otros",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase: "Compra",
  production_consumption: "Consumo producción",
  waste: "Merma",
  adjustment_pos: "Ajuste (+)",
  adjustment_neg: "Ajuste (-)",
  return: "Devolución",
  transfer_out: "Transferencia salida",
  transfer_in: "Transferencia entrada",
  cook_consumption: "Consumo cocina",
  waste_pending: "Merma pendiente",
  waste_approved: "Merma aprobada",
};

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  purchase: "text-green-600",
  production_consumption: "text-red-600",
  waste: "text-orange-600",
  adjustment_pos: "text-blue-600",
  adjustment_neg: "text-blue-600",
  return: "text-purple-600",
  transfer_out: "text-amber-600",
  transfer_in: "text-teal-600",
  cook_consumption: "text-red-500",
  waste_pending: "text-orange-400",
  waste_approved: "text-orange-700",
};
