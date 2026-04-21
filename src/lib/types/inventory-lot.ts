import type { InventoryLot } from "./database";

export interface InventoryLotWithRelations extends InventoryLot {
  item_name: string;
  item_unit: string;
  site_name: string;
  supplier_name: string | null;
}

export interface LotFIFOSelection {
  lot_id: string;
  lot_code: string;
  quantity_to_consume: number;
}

export interface CreateLotInput {
  item_id: string;
  site_id: string;
  supplier_id?: string | null;
  lot_code: string;
  quantity_initial: number;
  unit: "g" | "kg" | "ml" | "l" | "un";
  cost_per_unit?: number | null;
  expires_at?: string | null;
  notes?: string | null;
}
