import { describe, expect, it } from "vitest";
import {
  actualUsageQty, classifyMenuItem, marginCents, marginPct, monthlyPriceImpactCents, ok, plateCostCents, popularityThreshold,
  priceChangePct, theoreticalUsageQty, varianceQty, variancePct,
} from "../../supabase/functions/_shared/metrics/index.ts";
import { generateSeed } from "../../scripts/seed/generate.ts";
import { CEDAR_LANE, ROLLING_TACOS } from "../../scripts/seed/specs.ts";

const ASOF = "2026-10-21";
const seed = generateSeed(ASOF);

const forRestaurant = <T extends { restaurant_id: string }>(rows: T[], rid: string) => rows.filter((r) => r.restaurant_id === rid);
const idOf = (name: string, rid: string, table: "ingredients" | "menu_items") => seed[table].find((r) => r.restaurant_id === rid && r.name === name)!.id;

describe("seed shape", () => {
  it("is deterministic: same date, same rows and ids", () => {
    expect(generateSeed(ASOF)).toEqual(seed);
  });

  it("covers at least 12 weeks of sales and labor for both restaurants", () => {
    for (const spec of [CEDAR_LANE, ROLLING_TACOS]) {
      const dates = new Set(forRestaurant(seed.sales_items, spec.id).map((s) => s.sale_date));
      expect(dates.size).toBeGreaterThanOrEqual(84);
      expect(forRestaurant(seed.labor_entries, spec.id).length).toBeGreaterThanOrEqual(84);
      expect(Math.max(...[...dates].map((d) => +d.replaceAll("-", "")))).toBe(+ASOF.replaceAll("-", ""));
    }
  });

  it("uses whole cents for every money column", () => {
    for (const s of seed.sales_items) expect(Number.isInteger(s.sales_cents)).toBe(true);
    for (const l of seed.labor_entries) expect(Number.isInteger(l.labor_cents)).toBe(true);
    for (const m of seed.menu_items) expect(Number.isInteger(m.price_cents)).toBe(true);
    for (const i of seed.invoice_items) expect(Number.isInteger(i.line_total_cents)).toBe(true);
    for (const i of seed.invoices) expect(Number.isInteger(i.total_cents)).toBe(true);
  });

  it("has unique ids and every reference points to a row in the same restaurant", () => {
    const tables = ["vendors", "ingredients", "invoices", "invoice_items", "menu_items", "recipe_items", "sales_items", "inventory_counts", "labor_entries"] as const;
    for (const t of tables) expect(new Set(seed[t].map((r) => r.id)).size).toBe(seed[t].length);
    const owner = (table: (typeof tables)[number]) => new Map<string, string>(seed[table].map((r) => [r.id, r.restaurant_id]));
    const vendors = owner("vendors"), ingredients = owner("ingredients"), invoices = owner("invoices"), menu = owner("menu_items");
    for (const i of seed.invoice_items) {
      expect(invoices.get(i.invoice_id)).toBe(i.restaurant_id);
      expect(ingredients.get(i.ingredient_id)).toBe(i.restaurant_id);
    }
    for (const i of seed.invoices) expect(vendors.get(i.vendor_id)).toBe(i.restaurant_id);
    for (const r of seed.recipe_items) { expect(menu.get(r.menu_item_id)).toBe(r.restaurant_id); expect(ingredients.get(r.ingredient_id)).toBe(r.restaurant_id); }
    for (const s of seed.sales_items) expect(menu.get(s.menu_item_id)).toBe(s.restaurant_id);
    for (const c of seed.inventory_counts) expect(ingredients.get(c.ingredient_id)).toBe(c.restaurant_id);
  });

  it("invoice totals equal the sum of their lines", () => {
    for (const inv of seed.invoices) {
      const sum = seed.invoice_items.filter((i) => i.invoice_id === inv.id).reduce((a, i) => a + i.line_total_cents, 0);
      expect(inv.total_cents).toBe(sum);
    }
  });
});

describe("seed tells the stories the tables should show", () => {
  const priceAt = (rid: string, ingredientId: string, date: string) => {
    const invs = new Map(forRestaurant(seed.invoices, rid).map((i) => [i.id, i.invoice_date]));
    const items = forRestaurant(seed.invoice_items, rid).filter((i) => i.ingredient_id === ingredientId && invs.get(i.invoice_id)! <= date);
    return items.sort((a, b) => invs.get(a.invoice_id)!.localeCompare(invs.get(b.invoice_id)!)).at(-1)!.unit_cost_cents;
  };

  it("has price spikes and a price drop that the price-change formulas pick up", () => {
    const brisket = idOf("Brisket, whole packer", CEDAR_LANE.id, "ingredients");
    const before = priceAt(CEDAR_LANE.id, brisket, "2026-10-10");
    const after = priceAt(CEDAR_LANE.id, brisket, ASOF);
    const change = priceChangePct(before, after);
    expect(change.ok && change.value).toBeCloseTo(12, 0);

    const avocado = idOf("Avocado", ROLLING_TACOS.id, "ingredients");
    const avo = priceChangePct(priceAt(ROLLING_TACOS.id, avocado, "2026-10-01"), priceAt(ROLLING_TACOS.id, avocado, ASOF));
    expect(avo.ok && avo.value).toBeCloseTo(35, 0);

    const pasta = idOf("Elbow pasta", CEDAR_LANE.id, "ingredients");
    const drop = priceChangePct(priceAt(CEDAR_LANE.id, pasta, "2026-09-01"), priceAt(CEDAR_LANE.id, pasta, ASOF));
    expect(drop.ok && drop.value).toBeLessThan(0);

    const impact = monthlyPriceImpactCents(before, after, ok(200));
    expect(impact.ok && impact.value).toBeGreaterThan(0);
  });

  it("has a low-margin, high-sales item and a high-margin, low-sales item", () => {
    const rid = CEDAR_LANE.id;
    const unitCost = new Map<string, number>(CEDAR_LANE.ingredients.map((i) => [idOf(i.name, rid, "ingredients"), i.unitCostCents]));
    const units = new Map<string, number>();
    for (const s of forRestaurant(seed.sales_items, rid)) units.set(s.menu_item_id, (units.get(s.menu_item_id) ?? 0) + s.units);
    const total = [...units.values()].reduce((a, b) => a + b, 0);
    const min = popularityThreshold(total, units.size);
    const classes = new Map<string, string>();
    for (const m of forRestaurant(seed.menu_items, rid)) {
      const lines = forRestaurant(seed.recipe_items, rid).filter((r) => r.menu_item_id === m.id).map((r) => ({ qty: r.qty, unitCostCents: unitCost.get(r.ingredient_id) }));
      const margin = marginCents(m.price_cents, plateCostCents(lines));
      const pct = marginPct(m.price_cents, margin);
      classes.set(m.name, classifyMenuItem(pct, units.get(m.id)!, 65, min));
    }
    expect(classes.get("Brisket plate")).toBe("plowhorse");
    expect(classes.get("Burnt ends")).toBe("puzzle");
    expect(classes.get("Smoked sausage plate")).toBe("dog");
    expect([...classes.values()]).toContain("star");
  });

  it("Cedar Lane counts reconcile: beginning + purchases - ending = actual, and over-portioned items show variance", () => {
    const rid = CEDAR_LANE.id;
    const sundays = [...new Set(forRestaurant(seed.inventory_counts, rid).map((c) => c.count_date))].sort();
    const [from, to] = [sundays.at(-3)!, sundays.at(-2)!]; // a full Sunday-to-Sunday week
    const variance = new Map<string, number>();
    for (const ing of CEDAR_LANE.ingredients) {
      const id = idOf(ing.name, rid, "ingredients");
      const count = (d: string) => forRestaurant(seed.inventory_counts, rid).find((c) => c.ingredient_id === id && c.count_date === d)?.qty;
      const invs = new Map(forRestaurant(seed.invoices, rid).map((i) => [i.id, i.invoice_date]));
      const bought = forRestaurant(seed.invoice_items, rid)
        .filter((i) => i.ingredient_id === id && invs.get(i.invoice_id)! > from && invs.get(i.invoice_id)! <= to)
        .reduce((a, i) => a + i.qty, 0);
      const actual = actualUsageQty(count(from), bought, count(to));
      expect(actual.ok).toBe(true);

      const recipe = forRestaurant(seed.recipe_items, rid).filter((r) => r.ingredient_id === id);
      const lines = recipe.flatMap((r) =>
        forRestaurant(seed.sales_items, rid)
          .filter((s) => s.menu_item_id === r.menu_item_id && s.sale_date > from && s.sale_date <= to)
          .map((s) => ({ unitsSold: s.units, qtyPerUnit: r.qty })),
      );
      const theo = theoreticalUsageQty(lines);
      const v = variancePct(varianceQty(actual, theo), theo);
      if (v.ok) variance.set(ing.key, v.value);
    }
    expect(variance.get("brisket")!).toBeGreaterThan(8);
    expect(variance.get("ribs")!).toBeGreaterThan(10);
    expect(Math.abs(variance.get("pinto")!)).toBeLessThan(3);
  });

  it("the food truck has no inventory counts, so usage shows as missing", () => {
    expect(forRestaurant(seed.inventory_counts, ROLLING_TACOS.id)).toHaveLength(0);
    expect(forRestaurant(seed.invoices, ROLLING_TACOS.id).length).toBeGreaterThan(0);
  });

  it("food cost lands in a believable range", () => {
    for (const spec of [CEDAR_LANE, ROLLING_TACOS]) {
      const sales = forRestaurant(seed.sales_items, spec.id).reduce((a, s) => a + s.sales_cents, 0);
      const food = forRestaurant(seed.invoices, spec.id).reduce((a, i) => a + i.total_cents, 0);
      const labor = forRestaurant(seed.labor_entries, spec.id).reduce((a, l) => a + l.labor_cents, 0);
      expect(food / sales).toBeGreaterThan(0.2);
      expect(food / sales).toBeLessThan(0.45);
      expect(labor / sales).toBeGreaterThan(0.2);
      expect(labor / sales).toBeLessThan(0.4);
    }
  });
});
