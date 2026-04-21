import type { Supplier } from "./database";

export interface SupplierWithItemCount extends Supplier {
  item_count: number;
}

export interface CreateSupplierInput {
  organization_id: string;
  name: string;
  cuit?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
}
