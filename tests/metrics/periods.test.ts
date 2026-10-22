import { describe, expect, it } from "vitest";
import { comparisonRange, daysInRange, isIsoDate, resolvePeriod, type PeriodPreset } from "../../supabase/functions/_shared/metrics/index.ts";

// 2026-10-21 is a Wednesday.
const ASOF = "2026-10-21";
const range = (p: PeriodPreset, custom?: { start?: unknown; end?: unknown }, asOf = ASOF) => {
  const r = resolvePeriod(p, asOf, custom);
  if (!r.ok) throw new Error(r.reason);
  return r.range;
};

describe("resolvePeriod", () => {
  it("today", () => expect(range("today")).toEqual({ start: ASOF, end: ASOF }));
  it("this week runs Monday to today", () => expect(range("this_week")).toEqual({ start: "2026-10-19", end: ASOF }));
  it("this week on a Monday is just that day", () => expect(range("this_week", undefined, "2026-10-19")).toEqual({ start: "2026-10-19", end: "2026-10-19" }));
  it("this week on a Sunday covers the full week", () => expect(range("this_week", undefined, "2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" }));
  it("last week is the previous Monday to Sunday", () => expect(range("last_week")).toEqual({ start: "2026-10-12", end: "2026-10-18" }));
  it("this month runs from the 1st to today", () => expect(range("this_month")).toEqual({ start: "2026-10-01", end: ASOF }));
  it("last month is the whole previous month", () => expect(range("last_month")).toEqual({ start: "2026-09-01", end: "2026-09-30" }));
  it("last month crosses the year boundary", () => expect(range("last_month", undefined, "2026-01-15")).toEqual({ start: "2025-12-01", end: "2025-12-31" }));
  it("last month handles a leap-year February", () => expect(range("last_month", undefined, "2028-03-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" }));
});

describe("custom ranges are validated", () => {
  it("accepts a valid range", () => expect(range("custom", { start: "2026-09-01", end: "2026-09-30" })).toEqual({ start: "2026-09-01", end: "2026-09-30" }));
  it("rejects missing, malformed and impossible dates", () => {
    expect(resolvePeriod("custom", ASOF)).toEqual({ ok: false, reason: "custom_needs_dates" });
    expect(resolvePeriod("custom", ASOF, { start: "2026-9-1", end: "2026-09-30" })).toEqual({ ok: false, reason: "bad_date" });
    expect(resolvePeriod("custom", ASOF, { start: "2026-02-30", end: "2026-03-01" })).toEqual({ ok: false, reason: "bad_date" });
    expect(resolvePeriod("custom", ASOF, { start: 20260901, end: "2026-09-30" })).toEqual({ ok: false, reason: "bad_date" });
  });
  it("rejects an end before the start", () => expect(resolvePeriod("custom", ASOF, { start: "2026-09-30", end: "2026-09-01" })).toEqual({ ok: false, reason: "bad_range" }));
  it("rejects ranges longer than a year", () => expect(resolvePeriod("custom", ASOF, { start: "2025-01-01", end: "2026-10-01" })).toEqual({ ok: false, reason: "too_long" }));
  it("rejects a bad as-of date", () => expect(resolvePeriod("today", "nope")).toEqual({ ok: false, reason: "bad_date" }));
});

describe("comparisonRange", () => {
  it("previous period has the same length and ends the day before", () => {
    const cur = { start: "2026-10-12", end: "2026-10-18" };
    const prev = comparisonRange(cur, "previous_period")!;
    expect(prev).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(daysInRange(prev)).toBe(daysInRange(cur));
  });
  it("same period last year shifts both ends back a year", () => {
    expect(comparisonRange({ start: "2026-10-01", end: "2026-10-21" }, "same_period_last_year")).toEqual({ start: "2025-10-01", end: "2025-10-21" });
  });
  it("Feb 29 maps to Feb 28 the year before", () => {
    expect(comparisonRange({ start: "2028-02-29", end: "2028-02-29" }, "same_period_last_year")).toEqual({ start: "2027-02-28", end: "2027-02-28" });
  });
  it("a target comparison has no date range", () => expect(comparisonRange({ start: ASOF, end: ASOF }, "target")).toBeNull());
});

describe("isIsoDate", () => {
  it("only accepts real YYYY-MM-DD dates", () => {
    expect(isIsoDate("2026-10-21")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-10-21T00:00:00Z")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
