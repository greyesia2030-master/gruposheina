import type { Site, SiteType } from "./database";

export interface SiteWithCounts extends Site {
  item_count: number;
}

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  warehouse: "Almacén",
  kitchen: "Cocina",
  delivery_point: "Punto de entrega",
  distribution_hub: "Centro de distribución",
};

export const SITE_TYPE_ICONS: Record<SiteType, string> = {
  warehouse: "package",
  kitchen: "chef-hat",
  delivery_point: "map-pin",
  distribution_hub: "truck",
};
