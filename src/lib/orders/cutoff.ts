import { subDays, setHours, setMinutes, isBefore } from 'date-fns';

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
 * Si now() < cutoff_datetime → dentro de corte (true)
 */
export function isWithinCutoff(
  order: OrderForCutoff,
  menu: MenuForCutoff | null,
  organization: OrgForCutoff
): boolean {
  // Sin menú vinculado → considerar dentro de corte
  if (!order.menu_id || !menu) return true;

  const weekStart = new Date(menu.week_start);
  const [hours, minutes] = organization.cutoff_time.split(':').map(Number);

  // Calcular datetime de corte
  const cutoffDate = subDays(weekStart, organization.cutoff_days_before);
  const cutoffDateTime = setMinutes(setHours(cutoffDate, hours), minutes);

  return isBefore(new Date(), cutoffDateTime);
}
