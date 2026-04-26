import { subDays } from "date-fns";
import { getCutoffDateTime } from "@/lib/time";

interface OrderForCutoff {
  menu_id: string | null;
}

interface MenuForCutoff {
  week_start: string;
}

interface OrgForCutoff {
  cutoff_time: string; // formato "HH:MM" o "HH:MM:SS"
  cutoff_days_before: number;
  timezone: string; // IANA timezone
}

/**
 * Calcula si un pedido está dentro de la ventana de corte.
 * Dentro de corte = el cliente puede modificar libremente.
 *
 * Fórmula: cutoff_datetime = week_start - cutoff_days_before días, a las cutoff_time
 * interpretadas en la timezone de la organización. Si UTC now() < cutoff → dentro.
 */
export function isWithinCutoff(
  order: OrderForCutoff,
  menu: MenuForCutoff | null,
  organization: OrgForCutoff
): boolean {
  if (!order.menu_id || !menu) return true;

  // week_start llega como 'YYYY-MM-DD'. Usamos mediodía UTC para evitar que DST
  // desplace el día calendario al hacer la resta de días.
  const base = new Date(menu.week_start + "T12:00:00Z");
  const shifted = subDays(base, organization.cutoff_days_before);

  const cutoffUtc = getCutoffDateTime(shifted, organization.timezone, organization.cutoff_time);
  return Date.now() < cutoffUtc.getTime();
}
