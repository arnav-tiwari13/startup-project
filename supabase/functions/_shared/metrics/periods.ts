// Date ranges for the table period picker. Dates are plain YYYY-MM-DD strings, ranges are inclusive.
export const PERIOD_PRESETS = ["today", "this_week", "last_week", "this_month", "last_month", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
export const COMPARISONS = ["previous_period", "same_period_last_year", "target"] as const;
export type Comparison = (typeof COMPARISONS)[number];

export interface DateRange { start: string; end: string }
export type RangeResult = { ok: true; range: DateRange } | { ok: false; reason: "bad_date" | "bad_range" | "too_long" | "custom_needs_dates" };

export const MAX_RANGE_DAYS = 366;
const MS_DAY = 86_400_000;

const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** True only for real calendar dates in YYYY-MM-DD form (rejects 2026-02-30). */
export const isIsoDate = (d: unknown): d is string =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && fmt(parse(d)) === d;

export const addDays = (d: string, n: number) => fmt(parse(d) + n * MS_DAY);
export const daysInRange = (r: DateRange) => Math.round((parse(r.end) - parse(r.start)) / MS_DAY) + 1;

const mondayOf = (d: string) => addDays(d, -((new Date(parse(d)).getUTCDay() + 6) % 7));
const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`;

/** `asOf` is "today" for the restaurant (the table's last-updated date). Weeks run Monday to Sunday. */
export function resolvePeriod(preset: PeriodPreset, asOf: string, custom?: { start?: unknown; end?: unknown }): RangeResult {
  if (!isIsoDate(asOf)) return { ok: false, reason: "bad_date" };
  switch (preset) {
    case "today":
      return { ok: true, range: { start: asOf, end: asOf } };
    case "this_week":
      return { ok: true, range: { start: mondayOf(asOf), end: asOf } };
    case "last_week": {
      const start = addDays(mondayOf(asOf), -7);
      return { ok: true, range: { start, end: addDays(start, 6) } };
    }
    case "this_month":
      return { ok: true, range: { start: firstOfMonth(asOf), end: asOf } };
    case "last_month": {
      const end = addDays(firstOfMonth(asOf), -1);
      return { ok: true, range: { start: firstOfMonth(end), end } };
    }
    case "custom": {
      if (custom?.start === undefined || custom?.end === undefined) return { ok: false, reason: "custom_needs_dates" };
      if (!isIsoDate(custom.start) || !isIsoDate(custom.end)) return { ok: false, reason: "bad_date" };
      if (custom.start > custom.end) return { ok: false, reason: "bad_range" };
      const range = { start: custom.start, end: custom.end };
      return daysInRange(range) > MAX_RANGE_DAYS ? { ok: false, reason: "too_long" } : { ok: true, range };
    }
  }
}

/** The range to compare against, or null for "target" (a target is a number, not a range). */
export function comparisonRange(range: DateRange, comparison: Comparison): DateRange | null {
  if (comparison === "target") return null;
  if (comparison === "previous_period") {
    const n = daysInRange(range);
    return { start: addDays(range.start, -n), end: addDays(range.start, -1) };
  }
  return { start: shiftYear(range.start, -1), end: shiftYear(range.end, -1) };
}

/** Same calendar day one year earlier; Feb 29 becomes Feb 28. */
function shiftYear(d: string, years: number): string {
  const y = +d.slice(0, 4) + years;
  const shifted = `${String(y).padStart(4, "0")}${d.slice(4)}`;
  return isIsoDate(shifted) ? shifted : `${String(y).padStart(4, "0")}-02-28`;
}
