// Turns a Bundle into table rows. Every number comes from the shared metrics module; nothing here
// re-implements a formula. Anything that cannot be computed becomes a cell with `missing` set.
import {
  actualUsageQty, addDays, categorySpendPct, classifyMenuItem, estimatedProfitCents, foodCostPct, laborPct, marginCents,
  marginPct, missing, monthlyPriceImpactCents, monthlyUsageQty, ok, pctChange, plateCostCents, pointChange, popularityThreshold,
  primeCostPct, priceChangePct, profitContributionCents, rateAgainstTarget, theoreticalUsageQty, varianceCents, variancePct,
  varianceQty, vsTarget, isOk, type Comparison, type DateRange, type Metric,
} from "../metrics/index.ts";
import type { Bundle } from "./data.ts";
import type { Filters } from "./schema.ts";
import { resolveTargets, type Targets } from "./targets.ts";
import { CATEGORY_LABELS, type Category, type Cell, type Row } from "./types.ts";

export interface Query { range: DateRange; prev: DateRange | null; comparison: Comparison }
export interface TableResult { rows: Row[]; notes: string[]; lastUpdated: string | null }

export interface Ctx {
  b: Bundle;
  q: Query;
  filters: Filters;
  groupBy: string | null;
  /** Restaurants in scope, sorted by name. Everything below reads only these. */
  ids: string[];
  restaurantName: (rid: string) => string;
  vendorName: (id: string | null | undefined) => string;
  ingredient: (id: string) => Bundle["ingredients"][number] | undefined;
  targetOf: (rid: string) => Targets;
  priceOn: (rid: string, ingredientId: string, date: string) => number | undefined;
}

export function makeCtx(bundle: Bundle, ids: string[], q: Query, filters: Filters, groupBy: string | null): Ctx {
  // Defense in depth: even if the caller handed over more rows, only the requested restaurants are used.
  let scope = new Set(ids);
  if (filters.location) scope = scope.has(filters.location) ? new Set([filters.location]) : new Set();
  const inScope = <T extends { restaurant_id: string }>(xs: T[]) => xs.filter((x) => scope.has(x.restaurant_id));
  const b: Bundle = {
    restaurants: bundle.restaurants.filter((r) => scope.has(r.id)),
    vendors: inScope(bundle.vendors),
    ingredients: inScope(bundle.ingredients),
    menuItems: inScope(bundle.menuItems),
    recipeItems: inScope(bundle.recipeItems),
    sales: inScope(bundle.sales),
    invoiceLines: inScope(bundle.invoiceLines),
    labor: inScope(bundle.labor),
    counts: inScope(bundle.counts),
    targets: new Map([...bundle.targets].filter(([rid]) => scope.has(rid))),
  };
  const names = new Map(b.restaurants.map((r) => [r.id, r.name]));
  const vendors = new Map(b.vendors.map((v) => [v.id, v.name]));
  const ingredients = new Map(b.ingredients.map((i) => [i.id, i]));
  const sortedIds = b.restaurants.map((r) => r.id); // restaurants already ordered by name by the loader

  // Price history per restaurant + ingredient, oldest first, for "price in effect on a date".
  const history = new Map<string, { date: string; cost: number }[]>();
  for (const l of b.invoiceLines) {
    const k = `${l.restaurant_id}|${l.ingredient_id}`;
    const arr = history.get(k) ?? [];
    arr.push({ date: l.date, cost: l.unit_cost_cents });
    history.set(k, arr);
  }
  for (const arr of history.values()) arr.sort((a, z) => a.date.localeCompare(z.date));

  return {
    b, q, filters, groupBy, ids: sortedIds,
    restaurantName: (rid) => names.get(rid) ?? "Unknown location",
    vendorName: (id) => (id ? vendors.get(id) : undefined) ?? "Unknown vendor",
    ingredient: (id) => ingredients.get(id),
    targetOf: (rid) => resolveTargets(b.targets.get(rid)),
    priceOn: (rid, ing, date) => {
      const arr = history.get(`${rid}|${ing}`);
      if (!arr) return undefined;
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].date <= date) return arr[i].cost;
      return undefined;
    },
  };
}

// ---- small helpers ---------------------------------------------------------------------------

const inR = (d: string, r: DateRange) => d >= r.start && d <= r.end;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const maxDate = (...lists: string[][]) => lists.flat().reduce<string | null>((m, d) => (m === null || d > m ? d : m), null);
const mean = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? sum(v) / v.length : null;
};

const text = (value: string): Cell => ({ value });
const blank = (): Cell => ({ value: null });
const mk = (m: Metric, extra: Partial<Cell> = {}): Cell => (m.ok ? { value: m.value, ...extra } : { value: null, missing: m.reason, ...extra });
const cmp = (m: Metric, unit: "pct" | "points"): NonNullable<Cell["compare"]> =>
  m.ok ? { value: m.value, unit } : { value: null, unit, missing: m.reason };

/** Change in a number (money, units) versus the chosen comparison. A target is not a dollar amount, so that is "no target". */
function compareAmount(c: Ctx, cur: Metric, prev: Metric | null): Metric {
  if (c.q.comparison === "target") return missing("no_target");
  if (!isOk(cur)) return cur;
  if (prev === null || !isOk(prev)) return missing("no_previous_period");
  return pctChange(cur.value, prev.value);
}

/** Change in a percentage metric versus the chosen comparison, in percentage points. */
function comparePct(c: Ctx, cur: Metric, prev: Metric | null, target: number | null): Metric {
  if (c.q.comparison === "target") return vsTarget(cur, target);
  return prev === null ? missing("no_previous_period") : pointChange(cur, prev);
}

const matches = (name: string, search: string | undefined) => !search || name.toLowerCase().includes(search.trim().toLowerCase());

// ---- 1. Profit snapshot ----------------------------------------------------------------------

function periodTotals(c: Ctx, rids: string[], r: DateRange) {
  const set = new Set(rids);
  const sales = c.b.sales.filter((s) => set.has(s.restaurant_id) && inR(s.sale_date, r));
  const food = c.b.invoiceLines.filter((l) => set.has(l.restaurant_id) && inR(l.date, r));
  const labor = c.b.labor.filter((l) => set.has(l.restaurant_id) && inR(l.entry_date, r));
  const salesM: Metric = sales.length ? ok(sum(sales.map((s) => s.sales_cents))) : missing("no_sales");
  const foodM: Metric = food.length ? ok(sum(food.map((l) => l.line_total_cents))) : missing("no_purchases");
  const laborM: Metric = labor.length ? ok(sum(labor.map((l) => l.labor_cents))) : missing("no_labor");
  const foodPctM = isOk(salesM) && isOk(foodM) ? foodCostPct(foodM.value, salesM.value) : !isOk(salesM) ? salesM : foodM;
  const laborPctM = isOk(salesM) && isOk(laborM) ? laborPct(laborM.value, salesM.value) : !isOk(salesM) ? salesM : laborM;
  const primeM = !isOk(salesM) ? salesM : !isOk(foodM) ? foodM : !isOk(laborM) ? laborM : primeCostPct(foodM.value, laborM.value, salesM.value);
  const profitM = !isOk(salesM) ? salesM : !isOk(foodM) ? foodM : !isOk(laborM) ? laborM : estimatedProfitCents(salesM.value, foodM.value, laborM.value);
  return { sales: salesM, food: foodM, labor: laborM, foodPct: foodPctM, laborPct: laborPctM, prime: primeM, profit: profitM };
}

function profitRow(c: Ctx, key: string, label: string, rids: string[]): Row {
  const cur = periodTotals(c, rids, c.q.range);
  const prev = c.q.prev ? periodTotals(c, rids, c.q.prev) : null;
  const t = rids.map((r) => c.targetOf(r));
  const tFood = mean(t.map((x) => x.food_cost_pct));
  const tLabor = mean(t.map((x) => x.labor_pct));
  const tPrime = mean(t.map((x) => x.prime_cost_pct));
  const money = (m: Metric, p: Metric | undefined): Cell => mk(m, { compare: cmp(compareAmount(c, m, p ?? null), "pct") });
  const pct = (m: Metric, p: Metric | undefined, target: number | null): Cell =>
    mk(m, { rating: rateAgainstTarget(m, target, "lower_is_better"), compare: cmp(comparePct(c, m, p ?? null, target), "points") });
  return {
    key,
    cells: {
      location: text(label),
      period: text(`${c.q.range.start} to ${c.q.range.end}`),
      sales: money(cur.sales, prev?.sales),
      food_cost: money(cur.food, prev?.food),
      food_cost_pct: pct(cur.foodPct, prev?.foodPct, tFood),
      labor: money(cur.labor, prev?.labor),
      labor_pct: pct(cur.laborPct, prev?.laborPct, tLabor),
      prime_cost_pct: pct(cur.prime, prev?.prime, tPrime),
      est_profit: money(cur.profit, prev?.profit),
    },
  };
}

export function profitSnapshot(c: Ctx): TableResult {
  const rows: Row[] = [];
  if (c.ids.length === 1) rows.push(profitRow(c, c.ids[0], c.restaurantName(c.ids[0]), c.ids));
  else if (c.ids.length > 1) {
    rows.push(profitRow(c, "all", "All locations", c.ids));
    if (c.groupBy === "location") for (const rid of c.ids) rows.push(profitRow(c, rid, c.restaurantName(rid), [rid]));
  }
  return {
    rows,
    notes: ["Food cost is what you bought (invoices dated in the period), not what you used. Labor is the labor cost you entered."],
    lastUpdated: maxDate(c.b.sales.map((s) => s.sale_date), c.b.invoiceLines.map((l) => l.date), c.b.labor.map((l) => l.entry_date)),
  };
}

// ---- 2. Food cost by category ----------------------------------------------------------------

export function foodCostByCategory(c: Ctx): TableResult {
  const by = c.groupBy === "vendor" || c.groupBy === "location" ? c.groupBy : "category";
  const cat = (ingredientId: string): Category => (c.ingredient(ingredientId)?.category ?? "other") as Category;
  const usable = c.b.invoiceLines.filter(
    (l) => (!c.filters.category || cat(l.ingredient_id) === c.filters.category) && (!c.filters.vendor || c.vendorName(l.vendor_id) === c.filters.vendor),
  );
  const groups = new Map<string, { label: string; category?: Category; spend: number; prevSpend: number; rids: Set<string> }>();
  const add = (l: (typeof usable)[number], field: "spend" | "prevSpend") => {
    const category = cat(l.ingredient_id);
    const key = by === "category" ? category : by === "vendor" ? l.vendor_id : l.restaurant_id;
    const label = by === "category" ? CATEGORY_LABELS[category] : by === "vendor" ? c.vendorName(l.vendor_id) : c.restaurantName(l.restaurant_id);
    const g = groups.get(key) ?? { label, category: by === "category" ? category : undefined, spend: 0, prevSpend: 0, rids: new Set<string>() };
    g[field] += l.line_total_cents;
    g.rids.add(l.restaurant_id);
    groups.set(key, g);
  };
  for (const l of usable) {
    if (inR(l.date, c.q.range)) add(l, "spend");
    else if (c.q.prev && inR(l.date, c.q.prev)) add(l, "prevSpend");
  }

  const salesFor = (rids: string[], r: DateRange): Metric => {
    const set = new Set(rids);
    const rows = c.b.sales.filter((s) => set.has(s.restaurant_id) && inR(s.sale_date, r));
    return rows.length ? ok(sum(rows.map((s) => s.sales_cents))) : missing("no_sales");
  };

  const rows: Row[] = [...groups].map(([key, g]) => {
    const rids = [...g.rids];
    const sales = salesFor(rids, c.q.range);
    const prevSales = c.q.prev ? salesFor(rids, c.q.prev) : null;
    const pct: Metric = isOk(sales) ? categorySpendPct(g.spend, sales.value) : sales;
    const prevPct: Metric | null = prevSales === null ? null : isOk(prevSales) ? categorySpendPct(g.prevSpend, prevSales.value) : prevSales;
    const target = g.category ? mean(rids.map((r) => c.targetOf(r).category[g.category!] ?? null)) : null;
    return {
      key,
      cells: {
        group: text(g.label),
        spend: mk(ok(g.spend), { compare: cmp(compareAmount(c, ok(g.spend), c.q.prev ? ok(g.prevSpend) : null), "pct") }),
        pct_of_sales: mk(pct, { rating: rateAgainstTarget(pct, target, "lower_is_better"), compare: cmp(comparePct(c, pct, prevPct, target), "points") }),
        target_pct: target === null ? { value: null, missing: "no_target" } : { value: target },
      },
    };
  });
  return {
    rows,
    notes: rows.length ? [] : ["No invoices in this period."],
    lastUpdated: maxDate(c.b.sales.map((s) => s.sale_date), c.b.invoiceLines.map((l) => l.date)),
  };
}

// ---- 3. Ingredient price changes -------------------------------------------------------------

export function ingredientPriceChanges(c: Ctx): TableResult {
  const window = { start: addDays(c.q.range.end, -27), end: c.q.range.end };
  const byItem = new Map<string, Bundle["invoiceLines"]>();
  for (const l of c.b.invoiceLines) {
    const k = `${l.restaurant_id}|${l.ingredient_id}`;
    byItem.set(k, [...(byItem.get(k) ?? []), l]);
  }

  type Item = { rid: string; ing: NonNullable<ReturnType<Ctx["ingredient"]>>; vendor: string; prev?: number; cur: number; impact: Metric; change: Metric };
  const items: Item[] = [];
  for (const [k, lines] of byItem) {
    const [rid, ingId] = k.split("|");
    const ing = c.ingredient(ingId);
    if (!ing) continue;
    lines.sort((a, z) => a.date.localeCompare(z.date));
    const inPeriod = lines.filter((l) => inR(l.date, c.q.range));
    if (inPeriod.length === 0) continue;
    const latest = inPeriod[inPeriod.length - 1];
    const before = lines.filter((l) => l.date < c.q.range.start);
    const prev = before.length ? before[before.length - 1].unit_cost_cents : undefined;
    const vendor = c.vendorName(latest.vendor_id);
    if (c.filters.vendor && vendor !== c.filters.vendor) continue;
    if (c.filters.category && ing.category !== c.filters.category) continue;
    if (!matches(ing.name, c.filters.search)) continue;
    const change = prev === undefined ? missing("no_previous_period") : priceChangePct(prev, latest.unit_cost_cents);
    if (c.filters.only_increases && !(isOk(change) && change.value > 0)) continue;
    const qty = sum(lines.filter((l) => inR(l.date, window)).map((l) => l.qty));
    const impact = prev === undefined ? missing("no_previous_period") : monthlyPriceImpactCents(prev, latest.unit_cost_cents, monthlyUsageQty(qty, 28));
    items.push({ rid, ing, vendor, prev, cur: latest.unit_cost_cents, impact, change });
  }

  const grouped = c.groupBy === "vendor" || c.groupBy === "category";
  const rows: Row[] = grouped
    ? groupItems(items, (i) => (c.groupBy === "vendor" ? i.vendor : CATEGORY_LABELS[i.ing.category as Category] ?? i.ing.category), (list) => ({
        item: blank(), location: blank(), vendor: blank(), previous_price: blank(), current_price: blank(), change_pct: blank(),
        monthly_impact: mk(sumOk(list.map((i) => i.impact))),
        items: { value: list.length },
      }), (label) => ({ item: text(label) }))
    : items.map((i) => ({
        key: `${i.rid}|${i.ing.id}`,
        cells: {
          item: text(i.ing.name),
          location: text(c.restaurantName(i.rid)),
          vendor: text(i.vendor),
          previous_price: i.prev === undefined ? { value: null, missing: "no_previous_period" as const, unit: i.ing.unit } : { value: i.prev, unit: i.ing.unit },
          current_price: { value: i.cur, unit: i.ing.unit },
          change_pct: mk(i.change),
          monthly_impact: mk(i.impact),
        },
      }));
  return {
    rows,
    notes: ["Each price is compared with the last price paid before the period started. The comparison setting does not apply here."],
    lastUpdated: maxDate(c.b.invoiceLines.map((l) => l.date)),
  };
}

/** Sum of the metrics that have a value; missing only when none do. */
function sumOk(ms: Metric[]): Metric {
  const good = ms.filter(isOk);
  return good.length ? ok(sum(good.map((m) => m.value))) : missing("no_previous_period");
}

function groupItems<T>(items: T[], keyOf: (i: T) => string, cells: (list: T[]) => Record<string, Cell>, label: (k: string) => Record<string, Cell>): Row[] {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(keyOf(i), [...(map.get(keyOf(i)) ?? []), i]);
  return [...map].map(([k, list]) => ({ key: `group:${k}`, cells: { ...cells(list), ...label(k) } }));
}

// ---- 4. Menu margins -------------------------------------------------------------------------

export function menuMargins(c: Ctx): TableResult {
  const recipeBy = new Map<string, { ingredient_id: string; qty: number }[]>();
  for (const r of c.b.recipeItems) recipeBy.set(r.menu_item_id, [...(recipeBy.get(r.menu_item_id) ?? []), r]);

  const unitsIn = (rid: string, itemId: string, r: DateRange) =>
    sum(c.b.sales.filter((s) => s.restaurant_id === rid && s.menu_item_id === itemId && inR(s.sale_date, r)).map((s) => s.units));
  const plateAt = (rid: string, itemId: string, date: string): Metric =>
    plateCostCents((recipeBy.get(itemId) ?? []).map((r) => ({ qty: r.qty, unitCostCents: c.priceOn(rid, r.ingredient_id, date) })));

  const rows: Row[] = [];
  for (const rid of c.ids) {
    const items = c.b.menuItems.filter((m) => m.restaurant_id === rid && m.active);
    const units = new Map(items.map((m) => [m.id, unitsIn(rid, m.id, c.q.range)]));
    const popularityMin = popularityThreshold(sum([...units.values()]), items.length);
    const target = c.targetOf(rid).margin_pct;
    for (const m of items) {
      if (!matches(m.name, c.filters.search)) continue;
      const u = units.get(m.id)!;
      const plate = plateAt(rid, m.id, c.q.range.end);
      const margin = marginCents(m.price_cents, plate);
      const pct = marginPct(m.price_cents, margin);
      const contribution = profitContributionCents(margin, u);
      const cls = classifyMenuItem(pct, u, target, popularityMin);
      if (c.filters.flag && cls !== c.filters.flag) continue;

      const prevRange = c.q.prev;
      const prevUnits: Metric | null = prevRange ? ok(unitsIn(rid, m.id, prevRange)) : null;
      const prevPlate = prevRange ? plateAt(rid, m.id, prevRange.end) : null;
      const prevMargin = prevPlate ? marginCents(m.price_cents, prevPlate) : null;
      const prevPct = prevMargin ? marginPct(m.price_cents, prevMargin) : null;
      const prevContribution = prevMargin && prevUnits && isOk(prevUnits) ? profitContributionCents(prevMargin, prevUnits.value) : null;
      const amount = (cur: Metric, prev: Metric | null): Cell => mk(cur, { compare: cmp(compareAmount(c, cur, prev), "pct") });

      rows.push({
        key: `${rid}|${m.id}`,
        cells: {
          item: text(m.name),
          location: text(c.restaurantName(rid)),
          price: mk(ok(m.price_cents)),
          plate_cost: amount(plate, prevPlate),
          margin_dollars: amount(margin, prevMargin),
          margin_pct: mk(pct, { rating: rateAgainstTarget(pct, target, "higher_is_better"), compare: cmp(comparePct(c, pct, prevPct, target), "points") }),
          units_sold: amount(ok(u), prevUnits),
          profit_contribution: amount(contribution, prevContribution),
          flag:
            cls === "unknown"
              ? { value: null, missing: !isOk(pct) ? pct.reason : "no_target" }
              : { value: cls === "plowhorse" || cls === "puzzle" ? cls : null },
        },
      });
    }
  }
  return {
    rows,
    notes: ["Plate cost uses your latest ingredient prices as of the end of the period. Flags need a margin target."],
    lastUpdated: maxDate(c.b.sales.map((s) => s.sale_date), c.b.invoiceLines.map((l) => l.date)),
  };
}

// ---- 5. Actual vs. theoretical usage ---------------------------------------------------------

export function usageVariance(c: Ctx): TableResult {
  const itemsByIngredient = new Map<string, { menu_item_id: string; qty: number }[]>();
  for (const r of c.b.recipeItems) {
    const k = `${r.restaurant_id}|${r.ingredient_id}`;
    itemsByIngredient.set(k, [...(itemsByIngredient.get(k) ?? []), r]);
  }
  const countsBy = new Map<string, Bundle["counts"]>();
  for (const k of c.b.counts) {
    const key = `${k.restaurant_id}|${k.ingredient_id}`;
    countsBy.set(key, [...(countsBy.get(key) ?? []), k]);
  }
  for (const arr of countsBy.values()) arr.sort((a, z) => a.count_date.localeCompare(z.count_date));

  type Item = { rid: string; ing: NonNullable<ReturnType<Ctx["ingredient"]>>; vendor: string; theo: Metric; actual: Metric; vq: Metric; vd: Metric; vp: Metric; window: DateRange | null };
  const items: Item[] = [];
  for (const [k, recipe] of itemsByIngredient) {
    const [rid, ingId] = k.split("|");
    const ing = c.ingredient(ingId);
    if (!ing) continue;
    const vendor = c.vendorName(ing.vendor_id);
    if (c.filters.vendor && vendor !== c.filters.vendor) continue;
    if (c.filters.category && ing.category !== c.filters.category) continue;
    if (!matches(ing.name, c.filters.search)) continue;

    // Counts rarely land on the period's edges, so use the last count before the period and the last count in it.
    const counts = countsBy.get(k) ?? [];
    const begin = [...counts].reverse().find((x) => x.count_date < c.q.range.start);
    const end = [...counts].reverse().find((x) => x.count_date <= c.q.range.end);
    const noCount = !begin || !end || end.count_date <= begin.count_date;
    if (noCount) {
      const m = missing("missing_inventory_count");
      items.push({ rid, ing, vendor, theo: m, actual: m, vq: m, vd: m, vp: m, window: null });
      continue;
    }
    const window = { start: addDays(begin.count_date, 1), end: end.count_date };
    const bought = sum(c.b.invoiceLines.filter((l) => l.restaurant_id === rid && l.ingredient_id === ingId && inR(l.date, window)).map((l) => l.qty));
    const lines = recipe.flatMap((r) =>
      c.b.sales.filter((s) => s.restaurant_id === rid && s.menu_item_id === r.menu_item_id && inR(s.sale_date, window)).map((s) => ({ unitsSold: s.units, qtyPerUnit: r.qty })),
    );
    const theo = theoreticalUsageQty(lines);
    const actual = actualUsageQty(begin.qty, bought, end.qty);
    const vq = varianceQty(actual, theo);
    items.push({ rid, ing, vendor, theo, actual, vq, vd: varianceCents(vq, c.priceOn(rid, ingId, window.end)), vp: variancePct(vq, theo), window });
  }

  const by = c.groupBy === "vendor" || c.groupBy === "category" || c.groupBy === "location" ? c.groupBy : null;
  const rows: Row[] = by
    ? groupItems(items, (i) => (by === "vendor" ? i.vendor : by === "category" ? CATEGORY_LABELS[i.ing.category as Category] ?? i.ing.category : c.restaurantName(i.rid)), (list) => {
        const vd = sumOk(list.map((i) => i.vd));
        return {
          item: blank(), location: blank(), vendor: blank(), theoretical_qty: blank(), actual_qty: blank(), variance_qty: blank(), variance_pct: blank(),
          variance_dollars: isOk(vd) ? vd : { value: null, missing: "missing_inventory_count" },
          items: { value: list.length },
        };
      }, (label) => ({ item: text(label) }))
    : items.map((i) => ({
        key: `${i.rid}|${i.ing.id}`,
        cells: {
          item: text(i.ing.name),
          location: text(c.restaurantName(i.rid)),
          vendor: text(i.vendor),
          theoretical_qty: mk(i.theo, { unit: i.ing.unit }),
          actual_qty: mk(i.actual, { unit: i.ing.unit }),
          variance_qty: mk(i.vq, { unit: i.ing.unit }),
          variance_dollars: mk(i.vd),
          variance_pct: mk(i.vp),
        },
      }));

  const windows = [...new Set(items.filter((i) => i.window).map((i) => `${i.window!.start} to ${i.window!.end}`))];
  const notes = [
    windows.length ? `Based on inventory counts covering ${windows.length === 1 ? windows[0] : "the dates in each row's window"}.` : "No inventory counts cover this period yet, so usage cannot be measured.",
  ];
  return {
    rows,
    notes,
    lastUpdated: maxDate(c.b.counts.map((k) => k.count_date), c.b.sales.map((s) => s.sale_date)),
  };
}
