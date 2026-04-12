import { formatInTimeZone } from "date-fns-tz";

export const ART_TZ = "America/Argentina/Buenos_Aires";

export function formatART(date: Date | string | number, pattern: string): string {
  return formatInTimeZone(date, ART_TZ, pattern);
}
