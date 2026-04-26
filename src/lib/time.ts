import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfISOWeek } from "date-fns";

/** Fecha/hora actual representada en la timezone de la org. */
export function nowInOrgTz(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Datetime UTC en que ocurre el cutoff para la fecha base dada.
 * baseDate debe representar el día calendario correcto (ej: week_start al mediodía UTC).
 * cutoffTime: "HH:MM" o "HH:MM:SS" (formato Postgres time).
 */
export function getCutoffDateTime(
  baseDate: Date,
  timezone: string,
  cutoffTime: string
): Date {
  const [h, m] = cutoffTime.split(":");
  const yyyy = baseDate.getUTCFullYear();
  const mm = String(baseDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(baseDate.getUTCDate()).padStart(2, "0");
  return fromZonedTime(
    `${yyyy}-${mm}-${dd} ${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`,
    timezone
  );
}

/** true si Date.now() ya superó el cutoff de baseDate en la timezone dada. */
export function isPastCutoff(
  baseDate: Date,
  timezone: string,
  cutoffTime: string
): boolean {
  return Date.now() > getCutoffDateTime(baseDate, timezone, cutoffTime).getTime();
}

/** Milisegundos hasta el cutoff (negativo si ya pasó). */
export function msUntilCutoff(
  baseDate: Date,
  timezone: string,
  cutoffTime: string
): number {
  return getCutoffDateTime(baseDate, timezone, cutoffTime).getTime() - Date.now();
}

/** Formato HH:MM:SS para countdown timers. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Inicio de semana ISO (lunes 00:00) en la timezone de la org, retornado como UTC. */
export function startOfWeekInTz(date: Date, timezone: string): Date {
  const zoned = toZonedTime(date, timezone);
  const monday = startOfISOWeek(zoned);
  return fromZonedTime(monday, timezone);
}
