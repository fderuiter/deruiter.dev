/**
 * Integer calendar arithmetic for the warehouse, after Howard Hinnant's
 * `days_from_civil` and `civil_from_days`. A day is its count of days since
 * 1970-01-01 in the proleptic Gregorian calendar; no `Date`, time zone or
 * locale is involved, and the gold build calls these tens of thousands of
 * times.
 */

/** Day number of an ISO 8601 date, or of the date part of a timestamp. */
export function dayNumber(iso: string): number {
  let year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (month <= 2) year -= 1;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/** ISO 8601 date of a day number. */
export function isoDay(dayNum: number): string {
  const z = dayNum + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365
  );
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Days from one ISO 8601 date (or timestamp) to another. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** The ISO 8601 date a whole number of days after another. */
export function addDays(iso: string, days: number): string {
  return isoDay(dayNumber(iso) + days);
}

/** Last day of the month holding an ISO 8601 date. */
export function monthEnd(iso: string): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const next =
    month === 12
      ? `${String(year + 1).padStart(4, "0")}-01-01`
      : `${iso.slice(0, 4)}-${String(month + 1).padStart(2, "0")}-01`;
  return isoDay(dayNumber(next) - 1);
}

/** ISO 8601 day of the week of a day number: Monday 1 to Sunday 7. */
export function isoWeekday(dayNum: number): number {
  // 1970-01-01 was a Thursday (4).
  return ((((dayNum + 3) % 7) + 7) % 7) + 1;
}
