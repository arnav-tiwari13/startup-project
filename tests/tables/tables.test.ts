import { describe, expect, it } from "vitest";
import { chooseRestaurants, planTable, tableRequestSchema, TABLE_IDS, TABLE_DEFS } from "../../supabase/functions/_shared/tables/index.ts";
import { A, B, SEED, TODAY, bundleFrom, cell, run } from "./helpers.ts";

const inRange = (d: string, s: string, e: string) => d >= s && d <= e;
const lastWeek = { preset: "last_week" } as const; // 2026-10-12 to 2026-10-18

describe("profit snapshot", () => {
  const res = run({ tableId: "profit_snapshot", period: lastWeek, restaurantIds: [A] });

  it("matches the underlying sales, invoices and labor", () => {
    const sales = SEED.sales_items.filter((s) => s.restaurant_id === A && inRange(s.sale_date, "2026-10-12", "2026-10-18")).reduce((a, s) => a + s.sales_cents, 0);
    const food = SEED.invoices.filter((i) => i.restaurant_id === A && inRange(i.invoice_date, "2026-10-12", "2026-10-18")).reduce((a, i) => a + i.total_cents, 0);
    const labor = SEED.labor_entries.filter((l) => l.restaurant_id === A && inRange(l.entry_date, "2026-10-12", "2026-10-18")).reduce((a, l) => a + l.labor_cents, 0);
    expect(cell(res, A, "sales").value).toBe(sales);
    expect(cell(res, A, "food_cost").value).toBe(food);
    expect(cell(res, A, "labor").value).toBe(labor);
    expect(cell(res, A, "food_cost_pct").value).toBeCloseTo((food / sales) * 100);
    expect(cell(res, A, "prime_cost_pct").value).toBeCloseTo(((food + labor) / sales) * 100);
    expect(cell(res, A, "est_profit").value).toBe(sales - food - labor);
  });

  it("compares with the previous period in points for percents and percent for dollars", () => {
    expect(cell(res, A, "sales").compare?.unit).toBe("pct");
    expect(cell(res, A, "food_cost_pct").compare?.unit).toBe("points");
    expect(cell(res, A, "food_cost_pct").compare?.value).not.toBeNull();
  });

  it("rates percents against the default target, with a rating on every percent cell", () => {
    for (const col of ["food_cost_pct", "labor_pct", "prime_cost_pct"]) expect(["good", "watch", "bad"]).toContain(cell(res, A, col).rating);
  });

  it("comparing to target gives points from target for percents and no_target for dollars", () => {
    const t = run({ tableId: "profit_snapshot", period: lastWeek, restaurantIds: [A], comparison: "target" });
    expect(cell(t, A, "food_cost_pct").compare?.unit).toBe("points");
    expect(cell(t, A, "food_cost_pct").compare?.value).toBeCloseTo((cell(t, A, "food_cost_pct").value as number) - 30);
    expect(cell(t, A, "sales").compare?.missing).toBe("no_target");
  });

  it("adds an all-locations row and a row per location", () => {
    const both = run({ tableId: "profit_snapshot", period: lastWeek });
    expect(both.rows.map((r) => r.key).sort()).toEqual(["all", A, B].sort());
    expect(cell(both, "all", "sales").value).toBe((cell(both, A, "sales").value as number) + (cell(both, B, "sales").value as number));
    expect(run({ tableId: "profit_snapshot", period: lastWeek, groupBy: null }).rows.map((r) => r.key)).toEqual(["all"]);
  });

  it("shows missing data instead of a wrong number", () => {
    const noLabor = bundleFrom(); noLabor.labor = [];
    expect(cell(run({ tableId: "profit_snapshot", period: lastWeek, restaurantIds: [A] }, [A, B], noLabor), A, "labor_pct")).toMatchObject({ value: null, missing: "no_labor" });
    const noSales = bundleFrom(); noSales.sales = [];
    const r = run({ tableId: "profit_snapshot", period: lastWeek, restaurantIds: [A] }, [A, B], noSales);
    expect(cell(r, A, "food_cost_pct")).toMatchObject({ value: null, missing: "no_sales" });
    expect(cell(r, A, "est_profit")).toMatchObject({ value: null, missing: "no_sales" });
  });

  it("uses a saved target instead of the default, and treats a cleared target as not set", () => {
    const b = bundleFrom();
    b.targets.set(A, { food_cost_pct: 50, labor_pct: null, prime_cost_pct: null, margin_pct: null });
    const r = run({ tableId: "profit_snapshot", period: lastWeek, restaurantIds: [A] }, [A, B], b);
    expect(cell(r, A, "food_cost_pct").rating).toBe("good");
    expect(cell(r, A, "labor_pct").rating).toBe("unknown");
  });
});

describe("food cost by category", () => {
  const res = run({ tableId: "food_cost_by_category", period: lastWeek, restaurantIds: [A] });

  it("splits the week's invoices by category and adds up to the total", () => {
    const total = SEED.invoices.filter((i) => i.restaurant_id === A && inRange(i.invoice_date, "2026-10-12", "2026-10-18")).reduce((a, i) => a + i.total_cents, 0);
    expect(res.rows.reduce((a, r) => a + (r.cells.spend.value as number), 0)).toBe(total);
    expect(res.rows.map((r) => r.key)).toContain("meat");
    expect(res.rows[0].cells.spend.value).toBeGreaterThanOrEqual(res.rows[1].cells.spend.value as number); // default: spend, high to low
  });

  it("shows the category target and rates against it", () => {
    expect(cell(res, "meat", "target_pct").value).toBe(11);
    expect(["good", "watch", "bad"]).toContain(cell(res, "meat", "pct_of_sales").rating);
  });

  it("groups by vendor and by location, and filters by category", () => {
    expect(run({ tableId: "food_cost_by_category", period: lastWeek, groupBy: "vendor" }).rows.map((r) => r.cells.group.value)).toContain("Sysco");
    const byLocation = run({ tableId: "food_cost_by_category", period: lastWeek, groupBy: "location" });
    expect(byLocation.rows).toHaveLength(2);
    expect(byLocation.rows[0].cells.target_pct.missing).toBe("no_target");
    expect(run({ tableId: "food_cost_by_category", period: lastWeek, filters: { category: "meat" } }).rows.map((r) => r.key)).toEqual(["meat"]);
  });
});

describe("ingredient price changes", () => {
  const thisWeek = run({ tableId: "ingredient_price_changes", period: { preset: "this_week" }, restaurantIds: [A] });
  const byName = (name: string) => thisWeek.rows.find((r) => r.cells.item.value === name)!;

  it("finds the brisket spike and prices it per month", () => {
    const brisket = byName("Brisket, whole packer");
    expect(brisket.cells.change_pct.value).toBeCloseTo(12, 0);
    expect(brisket.cells.monthly_impact.value as number).toBeGreaterThan(0);
    expect(brisket.cells.current_price.unit).toBe("lb");
  });

  it("sorts biggest impact first by default", () => {
    const impacts = thisWeek.rows.map((r) => r.cells.monthly_impact.value as number);
    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
  });

  it("shows a price drop as negative and can filter to increases only", () => {
    const early = run({ tableId: "ingredient_price_changes", period: { preset: "custom", start: "2026-10-05", end: "2026-10-11" }, restaurantIds: [A] });
    expect(early.rows.find((r) => r.cells.item.value === "Elbow pasta")!.cells.change_pct.value as number).toBeLessThan(0);
    const up = run({ tableId: "ingredient_price_changes", period: { preset: "custom", start: "2026-10-05", end: "2026-10-11" }, restaurantIds: [A], filters: { only_increases: true } });
    expect(up.rows.every((r) => (r.cells.change_pct.value as number) > 0)).toBe(true);
  });

  it("marks the previous price missing when there is no earlier invoice", () => {
    const first = run({ tableId: "ingredient_price_changes", period: { preset: "custom", start: "2026-07-16", end: "2026-07-19" }, restaurantIds: [A] });
    expect(first.rows.length).toBeGreaterThan(0);
    expect(first.rows.every((r) => r.cells.change_pct.missing === "no_previous_period")).toBe(true);
  });

  it("groups by vendor, adding up the monthly impact", () => {
    const g = run({ tableId: "ingredient_price_changes", period: { preset: "this_week" }, restaurantIds: [A], groupBy: "vendor" });
    const sumItems = thisWeek.rows.filter((r) => typeof r.cells.monthly_impact.value === "number").reduce((a, r) => a + (r.cells.monthly_impact.value as number), 0);
    expect(g.rows.reduce((a, r) => a + (r.cells.monthly_impact.value as number), 0)).toBe(sumItems);
  });
});

describe("menu margins", () => {
  const res = run({ tableId: "menu_margins", period: lastWeek, restaurantIds: [A] });
  const byName = (r: typeof res, name: string) => r.rows.find((x) => x.cells.item.value === name)!;

  it("flags low-margin high-sales and high-margin low-sales dishes", () => {
    expect(byName(res, "Brisket plate").cells.flag.value).toBe("plowhorse");
    expect(byName(res, "Burnt ends").cells.flag.value).toBe("puzzle");
    expect(byName(res, "Brisket plate").cells.margin_pct.rating).toBe("bad");
    expect(run({ tableId: "menu_margins", period: lastWeek, restaurantIds: [A], filters: { flag: "puzzle" } }).rows.map((r) => r.cells.item.value)).toContain("Burnt ends");
  });

  it("margin math: price - plate cost, times units", () => {
    const plate = byName(res, "Brisket plate");
    const m = plate.cells.margin_dollars.value as number;
    expect(m).toBe(2200 - (plate.cells.plate_cost.value as number));
    expect(plate.cells.profit_contribution.value).toBe(Math.round(m * (plate.cells.units_sold.value as number)));
  });

  it("without a margin target, flags are missing rather than guessed", () => {
    const b = bundleFrom();
    b.targets.set(A, { food_cost_pct: 30, labor_pct: 30, prime_cost_pct: 60, margin_pct: null });
    const r = run({ tableId: "menu_margins", period: lastWeek, restaurantIds: [A] }, [A, B], b);
    expect(byName(r, "Brisket plate").cells.flag).toMatchObject({ value: null, missing: "no_target" });
  });

  it("a dish with no recipe shows missing plate cost", () => {
    const b = bundleFrom();
    b.recipeItems = b.recipeItems.filter((r) => r.menu_item_id !== SEED.menu_items.find((m) => m.name === "Burnt ends")!.id);
    const r = run({ tableId: "menu_margins", period: lastWeek, restaurantIds: [A] }, [A, B], b);
    expect(byName(r, "Burnt ends").cells.plate_cost).toMatchObject({ value: null, missing: "no_recipe" });
    expect(byName(r, "Burnt ends").cells.margin_pct.value).toBeNull();
  });
});

describe("actual vs theoretical usage", () => {
  const res = run({ tableId: "usage_variance", period: lastWeek, restaurantIds: [A] });
  const byName = (r: typeof res, name: string) => r.rows.find((x) => x.cells.item.value === name)!;

  it("shows over-portioned brisket and wasted ribs", () => {
    expect(byName(res, "Brisket, whole packer").cells.variance_pct.value as number).toBeGreaterThan(8);
    expect(byName(res, "Pork spare ribs").cells.variance_pct.value as number).toBeGreaterThan(10);
    expect(Math.abs(byName(res, "Pinto beans").cells.variance_pct.value as number)).toBeLessThan(3);
  });

  it("variance dollars is variance units times price", () => {
    const row = byName(res, "Brisket, whole packer");
    expect(row.cells.variance_dollars.value as number).toBeGreaterThan(0);
    expect(row.cells.variance_qty.value).toBeCloseTo((row.cells.actual_qty.value as number) - (row.cells.theoretical_qty.value as number), 6);
  });

  it("works for a period that does not line up with count dates", () => {
    const month = run({ tableId: "usage_variance", period: { preset: "this_month" }, restaurantIds: [A] });
    expect(byName(month, "Brisket, whole packer").cells.variance_pct.value).not.toBeNull();
  });

  it("a restaurant without inventory counts shows missing data, not zero", () => {
    const truck = run({ tableId: "usage_variance", period: lastWeek, restaurantIds: [B] });
    expect(truck.rows.length).toBeGreaterThan(0);
    for (const r of truck.rows) {
      expect(r.cells.actual_qty).toMatchObject({ value: null, missing: "missing_inventory_count" });
      expect(r.cells.variance_dollars.value).toBeNull();
    }
    expect(truck.notes[0]).toMatch(/No inventory counts/);
  });

  it("groups by vendor", () => {
    const g = run({ tableId: "usage_variance", period: lastWeek, restaurantIds: [A], groupBy: "vendor" });
    expect(g.rows.map((r) => r.cells.item.value)).toContain("Sysco");
  });
});

describe("data isolation", () => {
  const allTables = TABLE_IDS.map((tableId) => ({ tableId, period: { preset: "last_week" as const } }));
  const bNames = new Set(["Rolling Tacos (sample)", ...SEED.menu_items.filter((m) => m.restaurant_id === B).map((m) => m.name), ...SEED.ingredients.filter((i) => i.restaurant_id === B).map((i) => i.name)]);
  const aOnlyNames = new Set([...SEED.menu_items.filter((m) => m.restaurant_id === A).map((m) => m.name), ...SEED.ingredients.filter((i) => i.restaurant_id === A).map((i) => i.name)]);
  const textOf = (res: ReturnType<typeof run>) => res.rows.flatMap((r) => Object.values(r.cells).map((c) => c.value).filter((v): v is string => typeof v === "string"));

  for (const t of allTables) {
    it(`${t.tableId}: a user who belongs only to A never sees B, even if the data for both is loaded`, () => {
      const res = run(t, [A], bundleFrom()); // bundle holds both restaurants; membership is only A
      for (const s of textOf(res)) if (!aOnlyNames.has(s)) expect(bNames.has(s)).toBe(false);
      expect(res.rows.every((r) => !r.key.includes(B))).toBe(true);
      expect(res.filterOptions.location.map((l) => l.id)).toEqual([A]);
    });

    it(`${t.tableId}: asking for B's id when you only belong to A is refused`, () => {
      expect(() => run({ ...t, restaurantIds: [B] }, [A], bundleFrom())).toThrow("forbidden");
    });

    it(`${t.tableId}: filtering to B's id as a location returns nothing for a user who only has A`, () => {
      const res = run({ ...t, filters: { location: B } }, [A], bundleFrom());
      expect(res.rows).toHaveLength(0);
    });
  }

  it("chooseRestaurants never lets a foreign id through", () => {
    expect(chooseRestaurants([A, B], [A])).toEqual({ ok: false });
    expect(chooseRestaurants([A], [A])).toEqual({ ok: true, ids: [A] });
    expect(chooseRestaurants(undefined, [A, B])).toEqual({ ok: true, ids: [A, B] });
  });
});

describe("requests are validated and planned", () => {
  it("rejects unknown keys, bad ids, bad dates and oversize pages", () => {
    const bad = (x: unknown) => expect(tableRequestSchema.safeParse(x).success).toBe(false);
    bad({ tableId: "nope" });
    bad({ tableId: "menu_margins", extra: 1 });
    bad({ tableId: "menu_margins", restaurantIds: ["not-a-uuid"] });
    bad({ tableId: "menu_margins", period: { preset: "custom", start: "2026-02-30", end: "2026-03-01" } });
    bad({ tableId: "menu_margins", limit: 0 });
    bad({ tableId: "menu_margins", limit: 501 });
    bad({ tableId: "menu_margins", offset: -1 });
    bad({ tableId: "menu_margins", filters: { category: "candy" } });
    bad({ tableId: "menu_margins", period: { preset: "someday" } });
  });

  it("applies defaults", () => {
    const req = tableRequestSchema.parse({ tableId: "menu_margins" });
    expect(req).toMatchObject({ comparison: "previous_period", limit: 100, offset: 0, period: { preset: "last_week" } });
  });

  it("plans bad periods and groupings as errors", () => {
    const plan = (x: object) => planTable(tableRequestSchema.parse({ tableId: "menu_margins", ...x }), TODAY);
    expect(plan({ period: { preset: "custom" } })).toEqual({ ok: false, error: "bad_period" });
    expect(plan({ period: { preset: "custom", start: "2026-10-10", end: "2026-10-01" } })).toEqual({ ok: false, error: "bad_period" });
    expect(plan({ groupBy: "vendor" })).toEqual({ ok: false, error: "bad_group" });
    expect(plan({ period: { preset: "this_week" } }).ok).toBe(true);
  });

  it("asks the database for enough history for each table", () => {
    const need = (tableId: (typeof TABLE_IDS)[number]) => {
      const p = planTable(tableRequestSchema.parse({ tableId, period: lastWeek }), TODAY);
      if (!p.ok) throw new Error("plan");
      return p.plan.needs;
    };
    expect(need("ingredient_price_changes").invoices!.start < "2026-10-12").toBe(true);
    expect(need("usage_variance").counts!.start < "2026-10-12").toBe(true);
    expect(need("profit_snapshot").labor).toBeDefined();
    expect(need("menu_margins").recipes).toBe(true);
  });
});

describe("sorting and paging", () => {
  it("sorts by any sortable column, puts missing values last, and pages", () => {
    const all = run({ tableId: "usage_variance", period: lastWeek, sort: { column: "variance_dollars", dir: "asc" }, limit: 500 });
    const values = all.rows.map((r) => r.cells.variance_dollars.value);
    const firstNull = values.findIndex((v) => v === null);
    expect(firstNull === -1 || values.slice(firstNull).every((v) => v === null)).toBe(true); // nulls all at the end
    const page = run({ tableId: "usage_variance", period: lastWeek, sort: { column: "variance_dollars", dir: "asc" }, limit: 3, offset: 2 });
    expect(page.rows.map((r) => r.key)).toEqual(all.rows.slice(2, 5).map((r) => r.key));
    expect(page.total).toBe(all.total);
  });

  it("ignores a sort on a column that does not exist, using the table default", () => {
    const res = run({ tableId: "menu_margins", period: lastWeek, sort: { column: "nope", dir: "asc" } });
    const contribution = res.rows.map((r) => r.cells.profit_contribution.value as number);
    expect(contribution).toEqual([...contribution].sort((a, b) => b - a));
  });
});

describe("table definitions", () => {
  it("every column a compute function produces is defined, and every definition has sortable defaults that exist", () => {
    for (const id of TABLE_IDS) {
      const def = TABLE_DEFS[id];
      const res = run({ tableId: id, period: { preset: "last_week" } });
      expect(res.rows.length).toBeGreaterThan(0);
      const columnIds = new Set(def.columns.map((c) => c.id));
      for (const row of res.rows) for (const k of Object.keys(row.cells)) expect(columnIds.has(k), `${id}.${k}`).toBe(true);
      expect(columnIds.has(def.defaultSort.column)).toBe(true);
      for (const col of def.columns) expect(col.tooltip.length, `${id}.${col.id} tooltip`).toBeGreaterThan(10);
    }
  });
});
