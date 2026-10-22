// The advisor's numbers for a real restaurant. Every figure comes from the same code the dashboard tables run
// (tables/ -> metrics/), so the two cannot disagree. This file only chooses a date range, asks for the table, and
// reshapes its cells into the tool result the model expects. Money is whole cents until the last step, where
// `dollars` converts for the tool boundary.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays, averageDailySalesCents, foodCostPct, isOk, MISSING_LABEL, ok, theoreticalFoodCostCents,
  type DateRange, type Metric, type MissingReason,
} from "../metrics/index.ts";
import {
  executeTable, loadBundle, planTable, tableRequestSchema, type Bundle, type Needs, type TableId, type TableResponse,
} from "../tables/index.ts";
import type { Cell, Row } from "../tables/types.ts";
import {
  PERIOD_DAYS, type ActualVsTheoreticalResult, type FoodCostResult, type MenuMarginsResult, type NoData, type Period,
  type PriceChange, type PriceChangesResult, type RestaurantData, type Result, type SalesSummaryResult, type VarianceRow,
} from "./types.ts";

/** Loads the rows a table needs for the given restaurants. The live version runs as the signed-in user. */
export type BundleLoader = (restaurantIds: string[], needs: Needs) => Promise<Bundle>;

export const liveBundleLoader = (db: SupabaseClient, userId: string): BundleLoader => (ids, needs) => loadBundle(db, userId, ids, needs);

const todayUtc = () => new Date().toISOString().slice(0, 10);

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
/** The only place cents become dollars. */
const dollars = (cents: number) => r2(cents / 100);
/** Unit prices are fractional cents (cost per ounce), so keep more places than a dollar amount. */
const unitDollars = (cents: number) => r4(cents / 100);

const noData = (message: string, needs: string): NoData => ({ error: "no_data", message, needs });
const num = (c: Cell | undefined): number | undefined => (c && typeof c.value === "number" ? c.value : undefined);
const str = (c: Cell | undefined): string => (c && typeof c.value === "string" ? c.value : "");
const asMetric = (c: Cell | undefined): Metric => {
  const n = num(c);
  return n !== undefined ? ok(n) : { ok: false, reason: (c?.missing ?? "invalid_input") as MissingReason };
};
const why = (c: Cell | undefined) => MISSING_LABEL[(c?.missing ?? "invalid_input") as MissingReason];

const MAX_ROWS = 500;

export class TableRestaurantData implements RestaurantData {
  readonly restaurantId: string;

  constructor(
    restaurantId: string,
    private readonly load: BundleLoader,
    private readonly today: () => string = todayUtc,
  ) {
    this.restaurantId = restaurantId;
  }

  private range(period: Period): DateRange {
    const end = this.today();
    return { start: addDays(end, -(PERIOD_DAYS[period] - 1)), end };
  }

  /** Runs one dashboard table for this restaurant only and over the given dates. */
  private async table(tableId: TableId, range: DateRange): Promise<TableResponse> {
    const req = tableRequestSchema.parse({
      tableId, restaurantIds: [this.restaurantId], period: { preset: "custom", ...range },
      comparison: "target", groupBy: null, limit: MAX_ROWS,
    });
    const planned = planTable(req, this.today());
    if (!planned.ok) throw new Error(planned.error);
    const bundle = await this.load([this.restaurantId], planned.plan.needs);
    return executeTable(planned.plan, bundle, [this.restaurantId]);
  }

  private noSales(period: Period): NoData {
    return noData(`No sales were recorded for ${period.replaceAll("_", " ")}.`, "Sales data (transactions by menu item) for this period");
  }

  async getFoodCost(period: Period): Promise<Result<FoodCostResult>> {
    const { start, end } = this.range(period);
    const snap = (await this.table("profit_snapshot", { start, end })).rows[0]?.cells ?? {};
    const sales = asMetric(snap.sales);
    if (!isOk(sales)) return this.noSales(period);
    const food = asMetric(snap.food_cost);
    const pct = asMetric(snap.food_cost_pct);
    if (!isOk(food) || !isOk(pct)) return noData("No supplier invoices were entered for this period, so food cost cannot be calculated.", "Supplier invoices dated in this period");

    // Theoretical cost: what the recipes say the food sold should have cost, from the menu margins table's plate costs.
    const margins = await this.table("menu_margins", { start, end });
    const theo = theoreticalFoodCostCents(margins.rows.map((r) => ({ plateCost: asMetric(r.cells.plate_cost), unitsSold: num(r.cells.units_sold) ?? 0 })));
    const theoPct = isOk(theo) ? foodCostPct(theo.value, sales.value) : theo;
    return {
      period, start, end,
      sales: dollars(sales.value),
      food_cost_dollars: dollars(food.value),
      food_cost_pct: r1(pct.value),
      basis: "invoice_purchases",
      theoretical_cost_dollars: isOk(theo) ? dollars(theo.value) : null,
      theoretical_pct: isOk(theoPct) ? r1(theoPct.value) : null,
    };
  }

  async getPriceChanges(period: Period): Promise<Result<PriceChangesResult>> {
    const { start, end } = this.range(period);
    const res = await this.table("ingredient_price_changes", { start, end });
    const changes: (PriceChange & { _sort: number })[] = [];
    for (const row of res.rows) {
      const c = row.cells;
      const change = num(c.change_pct);
      const prev = num(c.previous_price);
      const cur = num(c.current_price);
      if (change === undefined || change === 0 || prev === undefined || cur === undefined) continue;
      const impact = num(c.monthly_impact);
      changes.push({
        ingredient: str(c.item), vendor: str(c.vendor), unit: c.current_price?.unit ?? "",
        old_price: unitDollars(prev), new_price: unitDollars(cur), change_pct: r1(change),
        monthly_impact_dollars: impact === undefined ? null : dollars(impact),
        _sort: Math.abs(impact ?? 0),
      });
    }
    if (res.total === 0) return noData("No supplier invoices were entered for this period.", "Supplier invoices or price lists");
    changes.sort((a, b) => b._sort - a._sort);
    const out = changes.map(({ _sort: _, ...rest }) => rest);
    return out.length
      ? { period, start, end, changes: out }
      : { period, start, end, changes: [], note: "No ingredient prices changed in this period compared with the last price paid before it." };
  }

  async getMenuMargins(): Promise<Result<MenuMarginsResult>> {
    const end = this.today();
    const res = await this.table("menu_margins", { start: addDays(end, -27), end });
    if (res.total === 0) return noData("No menu items are set up.", "Your menu with prices and recipes");
    const items: MenuMarginsResult["items"] = [];
    const incomplete: { item: string; reason: string }[] = [];
    for (const row of res.rows) {
      const c = row.cells;
      const price = num(c.price);
      const plate = asMetric(c.plate_cost);
      const marginD = num(c.margin_dollars);
      const marginP = num(c.margin_pct);
      const fcp = price !== undefined && isOk(plate) ? foodCostPct(plate.value, price) : undefined;
      if (price === undefined || !isOk(plate) || marginD === undefined || marginP === undefined || !fcp || !isOk(fcp)) {
        incomplete.push({ item: str(c.item), reason: why(isOk(plate) ? c.margin_pct : c.plate_cost) });
        continue;
      }
      items.push({
        item: str(c.item), price: dollars(price), cost_per_plate: dollars(plate.value),
        margin_dollars: dollars(marginD), margin_pct: r1(marginP), food_cost_pct: r1(fcp.value),
      });
    }
    if (items.length === 0) return noData("No menu item can be costed yet because recipes or ingredient prices are missing.", "Recipes and supplier invoices with prices for every ingredient");
    items.sort((a, b) => b.food_cost_pct - a.food_cost_pct);
    return { as_of: end, items, ...(incomplete.length ? { incomplete_items: incomplete } : {}) };
  }

  async getActualVsTheoretical(period: Period): Promise<Result<ActualVsTheoreticalResult>> {
    const { start, end } = this.range(period);
    const res = await this.table("usage_variance", { start, end });
    const rows: VarianceRow[] = [];
    const without: string[] = [];
    let gapCents = 0;
    for (const row of res.rows as Row[]) {
      const c = row.cells;
      const theo = num(c.theoretical_qty);
      const actual = num(c.actual_qty);
      const vq = num(c.variance_qty);
      const vd = num(c.variance_dollars);
      if (theo === undefined || actual === undefined || vq === undefined) {
        without.push(str(c.item));
        continue;
      }
      gapCents += vd ?? 0;
      rows.push({
        ingredient: str(c.item), unit: c.theoretical_qty?.unit ?? "",
        theoretical_qty: r2(theo), actual_qty: r2(actual), variance_qty: r2(vq),
        variance_pct: num(c.variance_pct) === undefined ? 0 : r1(num(c.variance_pct)!),
        variance_dollars: dollars(vd ?? 0),
      });
    }
    if (rows.length === 0) {
      return noData(
        "Inventory counts do not cover this period, so actual usage cannot be compared with what recipes say should have been used.",
        "Inventory counts before and during the period, for ingredients used in recipes",
      );
    }
    rows.sort((a, b) => b.variance_dollars - a.variance_dollars);
    return {
      period, start, end,
      gap_dollars: dollars(gapCents),
      ingredients: rows,
      ...(without.length ? { ingredients_without_counts: without } : {}),
      ...(res.notes[0] ? { note: res.notes[0] } : {}),
    };
  }

  async getSalesSummary(period: Period): Promise<Result<SalesSummaryResult>> {
    const range = this.range(period);
    const snapRes = await this.table("profit_snapshot", range);
    const total = asMetric(snapRes.rows[0]?.cells.sales);
    if (!isOk(total)) return this.noSales(period);

    // The total is the dashboard's. The breakdowns below add up the same rows by item and by day.
    const bundle = await this.load([this.restaurantId], { sales: range });
    const names = new Map(bundle.menuItems.filter((m) => m.restaurant_id === this.restaurantId).map((m) => [m.id, m.name]));
    const rows = bundle.sales.filter((s) => s.restaurant_id === this.restaurantId && s.sale_date >= range.start && s.sale_date <= range.end);
    const perItem = new Map<string, { units: number; cents: number }>([...names.keys()].map((id) => [id, { units: 0, cents: 0 }]));
    const days = (PERIOD_DAYS[period]);
    const perDay = new Map<string, number>(Array.from({ length: days }, (_, i) => [addDays(range.start, i), 0]));
    for (const s of rows) {
      const cur = perItem.get(s.menu_item_id) ?? { units: 0, cents: 0 };
      cur.units += s.units;
      cur.cents += s.sales_cents;
      perItem.set(s.menu_item_id, cur);
      perDay.set(s.sale_date, (perDay.get(s.sale_date) ?? 0) + s.sales_cents);
    }
    const items = [...perItem].map(([id, v]) => ({ item: names.get(id) ?? "Unknown item", units: v.units, revenue: dollars(v.cents) }));
    const daily = [...perDay].map(([date, cents]) => ({ date, sales: dollars(cents) }));
    const avg = averageDailySalesCents(total.value, days);
    const byDay = [...daily].sort((a, b) => b.sales - a.sales);
    return {
      period, start: range.start, end: range.end,
      total_sales: dollars(total.value),
      total_units: items.reduce((s, i) => s + i.units, 0),
      avg_daily_sales: isOk(avg) ? dollars(avg.value) : 0,
      top_sellers: [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      slow_sellers: [...items].sort((a, b) => a.units - b.units).slice(0, 3),
      best_day: byDay[0],
      worst_day: byDay[byDay.length - 1],
      daily_totals: daily,
    };
  }
}
