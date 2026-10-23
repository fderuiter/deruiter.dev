/**
 * Calendar arithmetic for the portfolio generator. Dates are whole UTC days
 * since the Unix epoch and timestamps are whole UTC minutes, so every value
 * is an integer and formats the same in every time zone.
 */

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

/** Minutes in one day. */
export const MINUTES_PER_DAY = 1_440;

/** Day number of an ISO 8601 date (`YYYY-MM-DD`). */
export function toDay(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** ISO 8601 date of a day number. */
export function isoDate(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** ISO 8601 UTC timestamp, to the minute, of a minute number. */
export function isoMinute(minute: number): string {
  return `${new Date(minute * MS_PER_MINUTE).toISOString().slice(0, 16)}:00Z`;
}

/** Calendar quarter label, for example `2026-Q3`, of a day number. */
export function quarterOf(day: number): string {
  const iso = isoDate(day);
  const quarter = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
  return `${iso.slice(0, 4)}-Q${quarter}`;
}

/** Day number of the first day of the quarter after the one holding `day`. */
export function nextQuarterStart(day: number): number {
  const date = new Date(day * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = Math.floor(date.getUTCMonth() / 3) * 3 + 3;
  return Date.UTC(year, month, 1) / MS_PER_DAY;
}
