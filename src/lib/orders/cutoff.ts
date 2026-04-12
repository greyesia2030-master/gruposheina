import { subDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { ART_TZ } from "@/lib/utils/timezone";

interface OrderForCutoff {
  menu_id: string | null;
}

interface MenuForCutoff {
  week_start: string;
}

interface OrgForCutoff {
  cutoff_time: string; // formato "HH:MM" o "HH:MM:SS"
  cutoff_days_before: number;
}

/**
 * Calcula si un pedido está dentro de la ventana de corte.
 * Dentro de corte = el cliente puede modificar libremente.
 *
 * Fórmula: cutoff_datetime = week_start - cutoff_days_before días, a las cutoff_time
 * interpretadas en zona horaria de Buenos Aires. Si UTC now() < cutoff → dentro.
 */
export function isWithinCutoff(
  order: OrderForCutoff,
  menu: MenuForCutoff | null,
  organization: OrgForCutoff
): boolean {
  if (!order.menu_id || !menu) return true;

  const [hStr, mStr] = organization.cutoff_time.split(":");
  const hours = Number(hStr) || 0;
  const minutes = Number(mStr) || 0;

  // week_start llega como 'YYYY-MM-DD'. Restamos los días sobre un Date UTC
  // a mediodía para evitar que DST desplace el día calendario, y luego
  // construimos el datetime "YYYY-MM-DD HH:mm:ss" que interpretamos en ART.
  const base = new Date(menu.week_start + "T12:00:00Z");
  const shifted = subDays(base, organization.cutoff_days_before);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const mi = String(minutes).padStart(2, "0");

  const cutoffUtc = fromZonedTime(`${yyyy}-${mm}-${dd} ${hh}:${mi}:00`, ART_TZ);
  return Date.now() < cutoffUtc.getTime();
}
