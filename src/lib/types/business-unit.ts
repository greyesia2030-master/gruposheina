import type { BusinessUnit } from "./database";

export interface BusinessUnitWithStats extends BusinessUnit {
  organization_count: number;
}

export const BUSINESS_UNIT_LABELS: Record<string, string> = {
  VIA: "Viandas",
  COM: "Comedor",
  CON: "Congelados",
  EVE: "Eventos",
};
