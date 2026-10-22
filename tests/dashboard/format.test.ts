import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "../../src/dashboard/csv.ts";
import { formatCompare, formatPeriod, formatValue, missingText, MINUS } from "../../src/dashboard/format.ts";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import type { Cell, Row } from "../../supabase/functions/_shared/tables/types.ts";

describe("formatValue", () => {
  it("formats each kind of column", () => {
    expect(formatValue("cents", { value: 123456 })).toBe("$1,234.56");
    expect(formatValue("cents", { value: -5000 })).toBe(`${MINUS}$50.00`);
    expect(formatValue("cents_unit", { value: 549, unit: "lb" })).toBe("$5.49/lb");
    expect(formatValue("cents_unit", { value: 9, unit: "oz" })).toBe("$0.09/oz");
    expect(formatValue("pct", { value: 31.456 })).toBe("31.5%");
    expect(formatValue("qty", { value: 12.34, unit: "lb" })).toBe("12.3 lb");
    expect(formatValue("qty", { value: -3, unit: "lb" })).toBe(`${MINUS}3 lb`);
    expect(formatValue("count", { value: 1234 })).toBe("1,234");
    expect(formatValue("text", { value: "Sysco" })).toBe("Sysco");
    expect(formatValue("flag", { value: "plowhorse" })).toBe("Low margin, high sales");
  });

  it("says Missing data for a missing cell, and a dash for a plain empty one, never a number", () => {
    expect(formatValue("pct", { value: null, missing: "no_sales" })).toBe("Missing data");
    expect(formatValue("pct", { value: null })).toBe("—");
    expect(missingText({ value: null, missing: "missing_inventory_count" })).toBe("Inventory count is missing");
    expect(missingText({ value: 5 })).toBeNull();
  });

  it("shows zero as 0, not as missing", () => {
    expect(formatValue("cents", { value: 0 })).toBe("$0.00");
    expect(formatValue("count", { value: 0 })).toBe("0");
  });
});

describe("formatCompare", () => {
  const c = (value: number | null, unit: "pct" | "points"): Cell => ({ value: 1, compare: { value, unit } });
  it("shows signed percent and points", () => {
    expect(formatCompare(c(3.456, "pct"))).toBe("+3.5%");
    expect(formatCompare(c(-2, "points"))).toBe(`${MINUS}2.0 pts`);
    expect(formatCompare(c(0.01, "pct"))).toBe("0.0%");
  });
  it("shows nothing when there is nothing honest to compare", () => {
    expect(formatCompare(c(null, "pct"))).toBeNull();
    expect(formatCompare({ value: 1 })).toBeNull();
  });
});

describe("formatPeriod", () => {
  it("shows one day or a range", () => {
    expect(formatPeriod({ start: "2026-10-12", end: "2026-10-18" })).toBe("Oct 12 – Oct 18");
    expect(formatPeriod({ start: "2026-10-12", end: "2026-10-12" })).toBe("Oct 12");
  });
});

describe("CSV export", () => {
  const def = TABLE_DEFS.menu_margins;
  const cols = def.columns.filter((c) => ["item", "price", "margin_pct", "flag"].includes(c.id));
  const rows: Row[] = [
    { key: "1", cells: { item: { value: 'Mac "n" cheese, large' }, price: { value: 1250, compare: { value: -4.5, unit: "pct" } }, margin_pct: { value: 64.123, compare: { value: 1.5, unit: "points" } }, flag: { value: "plowhorse" } } },
    { key: "2", cells: { item: { value: "=HYPERLINK(\"evil\")" }, price: { value: -50 }, margin_pct: { value: null, missing: "no_recipe" }, flag: { value: null } } },
  ];
  const lines = toCsv(cols, rows).trimEnd().split("\r\n");

  it("writes labels, change columns, and raw numbers in column order", () => {
    expect(lines[0]).toBe("Menu item,Menu price,Menu price change (%),Margin %,Margin % change (pts),Flag");
    expect(lines[1]).toBe('"Mac ""n"" cheese, large",12.50,-4.50,64.12,1.50,"Low margin, high sales"');
  });

  it("leaves missing data blank, keeps negative numbers numeric, and defuses formulas in text", () => {
    expect(lines[2]).toBe(`"'=HYPERLINK(""evil"")",-0.50,,,,`); // quote-prefixed so it is text, then quoted for its inner quotes
    expect(csvField("-12.50", true)).toBe("-12.50");
    expect(csvField("-12.50")).toBe("'-12.50");
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvField("plain")).toBe("plain");
  });

  it("only exports the columns it is given", () => {
    expect(toCsv([cols[0]], rows).split("\r\n")[0]).toBe("Menu item");
  });
});
