import {
  PERIOD_DAYS,
  type ActualVsTheoreticalResult,
  type FoodCostResult,
  type MenuItem,
  type MenuMarginsResult,
  type NoData,
  type Period,
  type PriceChange,
  type PriceChangesResult,
  type RestaurantData,
  type RestaurantDataset,
  type Result,
  type SalesSummaryResult,
} from "./types.ts";

const MS_DAY = 86_400_000;
const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(parse(d) + n * MS_DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / MS_DAY);
const eachDay = (start: string, end: string) =>
  Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDays(start, i));

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const noData = (message: string, needs: string): NoData => ({ error: "no_data", message, needs });

/**
 * Computes every tool result from one restaurant's dataset. It only ever sees the dataset it was
 * built with, so it cannot return another restaurant's numbers.
 */
export class DatasetRestaurantData implements RestaurantData {
  readonly restaurantId: string;
  private readonly ds: RestaurantDataset;
  private readonly itemById: Map<string, MenuItem>;

  constructor(ds: RestaurantDataset) {
    this.ds = ds;
    this.restaurantId = ds.restaurantId;
    this.itemById = new Map(ds.menu.map((m) => [m.id, m]));
  }

  private range(period: Period) {
    const end = this.ds.asOf;
    return { start: addDays(end, -(PERIOD_DAYS[period] - 1)), end };
  }

  /** Unit cost in effect on `date`: the latest price point on or before it. */
  private priceOn(ingredientId: string, date: string): number | undefined {
    let best: { date: string; unitCost: number } | undefined;
    for (const p of this.ds.prices) {
      if (p.ingredientId === ingredientId && p.date <= date && (!best || p.date >= best.date)) best = p;
    }
    return best?.unitCost;
  }

  private salesIn(start: string, end: string) {
    return this.ds.sales.filter((s) => s.date >= start && s.date <= end && this.itemById.has(s.itemId));
  }

  /** Ingredient quantity and cost the recipes say were used, per ingredient. */
  private theoretical(start: string, end: string) {
    const byIng = new Map<string, { qty: number; cost: number }>();
    let missingPrice = false;
    for (const s of this.salesIn(start, end)) {
      const item = this.itemById.get(s.itemId)!;
      for (const line of item.recipe) {
        const price = this.priceOn(line.ingredientId, s.date);
        if (price === undefined) { missingPrice = true; continue; }
        const qty = line.qty * s.units;
        const cur = byIng.get(line.ingredientId) ?? { qty: 0, cost: 0 };
        cur.qty += qty;
        cur.cost += qty * price;
        byIng.set(line.ingredientId, cur);
      }
    }
    return { byIng, missingPrice };
  }

  private salesDollars(start: string, end: string) {
    return this.salesIn(start, end).reduce((sum, s) => sum + s.units * this.itemById.get(s.itemId)!.price, 0);
  }

  /** Counted usage for the period, only if inventory counts cover every day of it. */
  private actualUsage(start: string, end: string): Map<string, number> | null {
    const records = this.ds.usage.filter((u) => u.start >= start && u.end <= end);
    const covered = new Set<string>();
    for (const u of records) for (const d of eachDay(u.start, u.end)) covered.add(d);
    if (eachDay(start, end).some((d) => !covered.has(d))) return null;
    const out = new Map<string, number>();
    for (const u of records) out.set(u.ingredientId, (out.get(u.ingredientId) ?? 0) + u.actualUsed);
    return out;
  }

  private noSales(period: Period): NoData {
    return noData(`No sales were recorded for ${period.replaceAll("_", " ")}.`, "Sales data (transactions by menu item) for this period");
  }

  getFoodCost(period: Period): Result<FoodCostResult> {
    const { start, end } = this.range(period);
    const sales = this.salesDollars(start, end);
    if (sales === 0) return this.noSales(period);
    const th = this.theoretical(start, end);
    if (th.missingPrice) return noData("Some ingredients have no recorded price, so cost cannot be calculated.", "Vendor prices for every ingredient in your recipes");
    const theoCost = [...th.byIng.values()].reduce((s, v) => s + v.cost, 0);

    const usage = this.actualUsage(start, end);
    let cost = theoCost;
    let basis: FoodCostResult["basis"] = "theoretical_from_recipes";
    if (usage) {
      cost = 0;
      for (const [ingId, used] of usage) {
        const t = th.byIng.get(ingId);
        const avg = t && t.qty > 0 ? t.cost / t.qty : (this.priceOn(ingId, end) ?? 0);
        cost += used * avg;
      }
      basis = "actual_inventory_usage";
    }
    return {
      period, start, end,
      sales: r2(sales),
      food_cost_dollars: r2(cost),
      food_cost_pct: r1((cost / sales) * 100),
      basis,
      theoretical_cost_dollars: r2(theoCost),
      theoretical_pct: r1((theoCost / sales) * 100),
    };
  }

  getPriceChanges(period: Period): Result<PriceChangesResult> {
    const { start, end } = this.range(period);
    if (this.ds.prices.length === 0) return noData("No vendor prices are recorded.", "Vendor invoices or price lists");
    const before = addDays(start, -1);
    const days = new Set(eachDay(start, end));
    const changes: PriceChange[] = [];
    for (const ing of this.ds.ingredients) {
      const oldP = this.priceOn(ing.id, before);
      const newP = this.priceOn(ing.id, end);
      if (oldP === undefined || newP === undefined || oldP === newP) continue;
      // Extra spend actually incurred in the period: (price that day - old price) x recipe usage that day.
      let extra = 0;
      for (const s of this.salesIn(start, end)) {
        if (!days.has(s.date)) continue;
        const line = this.itemById.get(s.itemId)!.recipe.find((l) => l.ingredientId === ing.id);
        const p = this.priceOn(ing.id, s.date);
        if (line && p !== undefined) extra += (p - oldP) * line.qty * s.units;
      }
      changes.push({
        ingredient: ing.name, vendor: ing.vendor, unit: ing.unit,
        old_price: r2(oldP), new_price: r2(newP),
        change_pct: r1(((newP - oldP) / oldP) * 100),
        extra_cost_in_period: r2(extra),
      });
    }
    changes.sort((a, b) => Math.abs(b.extra_cost_in_period) - Math.abs(a.extra_cost_in_period));
    return changes.length
      ? { period, start, end, changes }
      : { period, start, end, changes: [], note: "No ingredient prices changed in this period." };
  }

  getMenuMargins(): Result<MenuMarginsResult> {
    if (this.ds.menu.length === 0) return noData("No menu items are set up.", "Your menu with prices and recipes");
    const items = [];
    for (const m of this.ds.menu) {
      let cost = 0;
      for (const line of m.recipe) {
        const p = this.priceOn(line.ingredientId, this.ds.asOf);
        if (p === undefined) return noData(`No price recorded for an ingredient in ${m.name}.`, "Vendor prices for every ingredient in your recipes");
        cost += line.qty * p;
      }
      items.push({
        item: m.name, price: r2(m.price), cost_per_plate: r2(cost),
        margin_dollars: r2(m.price - cost), margin_pct: r1(((m.price - cost) / m.price) * 100),
        food_cost_pct: r1((cost / m.price) * 100),
      });
    }
    items.sort((a, b) => b.food_cost_pct - a.food_cost_pct);
    return { as_of: this.ds.asOf, items };
  }

  getActualVsTheoretical(period: Period): Result<ActualVsTheoreticalResult> {
    const { start, end } = this.range(period);
    const sales = this.salesDollars(start, end);
    if (sales === 0) return this.noSales(period);
    const usage = this.actualUsage(start, end);
    if (!usage) {
      return noData(
        "Inventory counts do not cover this whole period, so actual usage cannot be compared with what recipes say should have been used.",
        "Inventory counts covering every day of the period",
      );
    }
    const th = this.theoretical(start, end);
    if (th.missingPrice) return noData("Some ingredients have no recorded price.", "Vendor prices for every ingredient in your recipes");

    const rows = [];
    let theoCost = 0;
    let actCost = 0;
    for (const ing of this.ds.ingredients) {
      const t = th.byIng.get(ing.id);
      const actual = usage.get(ing.id);
      if (!t && actual === undefined) continue;
      const tQty = t?.qty ?? 0;
      const aQty = actual ?? 0;
      const avg = t && t.qty > 0 ? t.cost / t.qty : (this.priceOn(ing.id, end) ?? 0);
      theoCost += t?.cost ?? 0;
      actCost += aQty * avg;
      rows.push({
        ingredient: ing.name, unit: ing.unit,
        theoretical_qty: r2(tQty), actual_qty: r2(aQty),
        variance_qty: r2(aQty - tQty),
        variance_pct: tQty > 0 ? r1(((aQty - tQty) / tQty) * 100) : 0,
        variance_dollars: r2((aQty - tQty) * avg),
      });
    }
    rows.sort((a, b) => b.variance_dollars - a.variance_dollars);
    const theoPct = (theoCost / sales) * 100;
    const actPct = (actCost / sales) * 100;
    return {
      period, start, end,
      theoretical_cost_dollars: r2(theoCost), actual_cost_dollars: r2(actCost), gap_dollars: r2(actCost - theoCost),
      theoretical_pct: r1(theoPct), actual_pct: r1(actPct), gap_pct_points: r1(actPct - theoPct),
      ingredients: rows,
    };
  }

  getSalesSummary(period: Period): Result<SalesSummaryResult> {
    const { start, end } = this.range(period);
    const rows = this.salesIn(start, end);
    if (rows.length === 0) return this.noSales(period);
    const perItem = new Map<string, { units: number; revenue: number }>();
    for (const m of this.ds.menu) perItem.set(m.id, { units: 0, revenue: 0 });
    const perDay = new Map<string, number>(eachDay(start, end).map((d) => [d, 0]));
    for (const s of rows) {
      const m = this.itemById.get(s.itemId)!;
      const cur = perItem.get(m.id)!;
      cur.units += s.units;
      cur.revenue += s.units * m.price;
      perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.units * m.price);
    }
    const items = [...perItem].map(([id, v]) => ({ item: this.itemById.get(id)!.name, units: v.units, revenue: r2(v.revenue) }));
    const daily = [...perDay].map(([date, sales]) => ({ date, sales: r2(sales) }));
    const total = daily.reduce((s, d) => s + d.sales, 0);
    const byRevenue = [...items].sort((a, b) => b.revenue - a.revenue);
    const bySlow = [...items].sort((a, b) => a.units - b.units);
    const sortedDays = [...daily].sort((a, b) => b.sales - a.sales);
    return {
      period, start, end,
      total_sales: r2(total),
      total_units: items.reduce((s, i) => s + i.units, 0),
      avg_daily_sales: r2(total / daily.length),
      top_sellers: byRevenue.slice(0, 5),
      slow_sellers: bySlow.slice(0, 3),
      best_day: sortedDays[0],
      worst_day: sortedDays[sortedDays.length - 1],
      daily_totals: daily,
    };
  }
}
