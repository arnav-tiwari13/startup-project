// The advisor and the dashboard tables must give the same numbers, because the advisor reads the tables' code.
import { describe, expect, it } from "vitest";
import { TableRestaurantData } from "../../supabase/functions/_shared/advisor/table-data.ts";
import { executeTool } from "../../supabase/functions/_shared/advisor/tools.ts";
import { isNoData, type NoData, type Period } from "../../supabase/functions/_shared/advisor/types.ts";
import { addDays } from "../../supabase/functions/_shared/metrics/index.ts";
import type { Bundle, Needs } from "../../supabase/functions/_shared/tables/index.ts";
import { A, B, SEED, TODAY, bundleFrom, cell, run } from "../tables/helpers.ts";

const PERIODS: Period[] = ["last_7_days", "last_14_days", "last_28_days"];
const DAYS = { last_7_days: 7, last_14_days: 14, last_28_days: 28 };
const range = (p: Period) => ({ start: addDays(TODAY, -(DAYS[p] - 1)), end: TODAY });
const period = (p: Period) => ({ preset: "custom" as const, ...range(p) });

function source(rid: string, bundle: Bundle = bundleFrom(), seen: string[][] = []) {
  return new TableRestaurantData(rid, async (ids: string[], _needs: Needs) => { seen.push(ids); return bundle; }, () => TODAY);
}
const ok = <T>(r: T): Exclude<T, NoData> => {
  if (isNoData(r)) throw new Error(`expected data, got ${JSON.stringify(r)}`);
  return r as Exclude<T, NoData>;
};
const dollars = (cents: number) => Math.round(cents) / 100;

describe("advisor numbers equal the dashboard tables (seed data)", () => {
  for (const rid of [A, B]) {
    for (const p of PERIODS) {
      const data = source(rid);

      it(`food cost % and dollars, ${p}`, async () => {
        const t = run({ tableId: "profit_snapshot", period: period(p), restaurantIds: [rid], comparison: "target" });
        const r = ok(await data.getFoodCost(p));
        expect(r.sales).toBe(dollars(cell(t, rid, "sales").value as number));
        expect(r.food_cost_dollars).toBe(dollars(cell(t, rid, "food_cost").value as number));
        expect(r.food_cost_pct).toBe(Math.round((cell(t, rid, "food_cost_pct").value as number) * 10) / 10);
        expect(r.basis).toBe("invoice_purchases");
      });

      it(`price changes, ${p}`, async () => {
        const t = run({ tableId: "ingredient_price_changes", period: period(p), restaurantIds: [rid], comparison: "target", groupBy: null });
        const r = ok(await data.getPriceChanges(p));
        const expected = t.rows.filter((row) => typeof row.cells.change_pct.value === "number" && row.cells.change_pct.value !== 0);
        expect(r.changes.length).toBe(expected.length);
        for (const c of r.changes) {
          const row = expected.find((e) => e.cells.item.value === c.ingredient)!;
          expect(c.change_pct).toBe(Math.round((row.cells.change_pct.value as number) * 10) / 10);
          expect(c.monthly_impact_dollars).toBe(row.cells.monthly_impact.value === null ? null : dollars(row.cells.monthly_impact.value as number));
          expect(c.old_price).toBeCloseTo((row.cells.previous_price.value as number) / 100, 4);
          expect(c.new_price).toBeCloseTo((row.cells.current_price.value as number) / 100, 4);
        }
      });

      it(`usage variance, ${p}`, async () => {
        const t = run({ tableId: "usage_variance", period: period(p), restaurantIds: [rid], comparison: "target", groupBy: null });
        const r = await data.getActualVsTheoretical(p);
        const withCounts = t.rows.filter((row) => row.cells.variance_qty.value !== null);
        if (withCounts.length === 0) { expect(isNoData(r)).toBe(true); return; }
        const res = ok(r);
        expect(res.ingredients.length).toBe(withCounts.length);
        for (const v of res.ingredients) {
          const row = withCounts.find((e) => e.cells.item.value === v.ingredient)!;
          expect(v.variance_qty).toBe(Math.round((row.cells.variance_qty.value as number) * 100) / 100);
          expect(v.variance_dollars).toBe(dollars(row.cells.variance_dollars.value as number));
          expect(v.theoretical_qty).toBe(Math.round((row.cells.theoretical_qty.value as number) * 100) / 100);
        }
      });
    }

    it("menu margins", async () => {
      const t = run({ tableId: "menu_margins", period: { preset: "custom", start: addDays(TODAY, -27), end: TODAY }, restaurantIds: [rid], comparison: "target" });
      const r = ok(await source(rid).getMenuMargins());
      expect(r.items.length + (r.incomplete_items?.length ?? 0)).toBe(t.rows.length);
      for (const m of r.items) {
        const row = t.rows.find((e) => e.cells.item.value === m.item)!;
        expect(m.cost_per_plate).toBe(dollars(row.cells.plate_cost.value as number));
        expect(m.margin_dollars).toBe(dollars(row.cells.margin_dollars.value as number));
        expect(m.margin_pct).toBe(Math.round((row.cells.margin_pct.value as number) * 10) / 10);
        expect(m.food_cost_pct).toBeCloseTo(100 - (row.cells.margin_pct.value as number), 1);
      }
    });

    it("sales summary total equals the profit snapshot and the daily totals add up", async () => {
      const t = run({ tableId: "profit_snapshot", period: period("last_14_days"), restaurantIds: [rid], comparison: "target" });
      const r = ok(await source(rid).getSalesSummary("last_14_days"));
      expect(r.total_sales).toBe(dollars(cell(t, rid, "sales").value as number));
      expect(r.daily_totals.reduce((s, d) => s + d.sales, 0)).toBeCloseTo(r.total_sales, 2);
    });
  }

  it("the seed produces real data for these checks (not all no_data)", async () => {
    expect(ok(await source(A).getFoodCost("last_28_days")).food_cost_pct).toBeGreaterThan(0);
    expect(ok(await source(A).getMenuMargins()).items.length).toBeGreaterThan(0);
  });
});

describe("TableRestaurantData missing data and isolation", () => {
  it("answers no_data when the business has no rows", async () => {
    const empty = bundleFrom({ ...SEED, sales_items: [], invoice_items: [], invoices: [], inventory_counts: [], menu_items: [], recipe_items: [] });
    const d = source(A, empty);
    for (const p of PERIODS) expect(isNoData(await d.getFoodCost(p))).toBe(true);
    expect(isNoData(await d.getMenuMargins())).toBe(true);
    expect(isNoData(await d.getActualVsTheoretical("last_7_days"))).toBe(true);
    expect(isNoData(await d.getSalesSummary("last_7_days"))).toBe(true);
  });

  it("only ever asks for its own restaurant, and never returns another's data even if the loader hands it everything", async () => {
    const seen: string[][] = [];
    const d = source(A, bundleFrom(), seen);
    const other = SEED.restaurants.find((r) => r.id === B)!.name;
    const itemsOfB = SEED.menu_items.filter((m) => m.restaurant_id === B).map((m) => m.name);
    const namesOfA = new Set(SEED.menu_items.filter((m) => m.restaurant_id === A).map((m) => m.name));
    const out = JSON.stringify([
      await executeTool(d, "get_menu_margins", {}), await executeTool(d, "get_food_cost", { period: "last_28_days" }),
      await executeTool(d, "get_price_changes", { period: "last_28_days" }), await executeTool(d, "get_actual_vs_theoretical", { period: "last_28_days" }),
      await executeTool(d, "get_sales_summary", { period: "last_28_days" }),
    ]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((ids) => ids.length === 1 && ids[0] === A)).toBe(true);
    expect(out).not.toContain(other);
    for (const name of itemsOfB.filter((n) => !namesOfA.has(n))) expect(out).not.toContain(name);
  });

  it("a loader failure becomes a generic tool error with no internal detail", async () => {
    const d = new TableRestaurantData(A, async () => { throw new Error("loading ingredients failed"); }, () => TODAY);
    const out = await executeTool(d, "get_food_cost", { period: "last_7_days" });
    expect(out).toMatchObject({ ok: false });
    expect(JSON.stringify(out)).not.toMatch(/ingredients/);
  });
});
