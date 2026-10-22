// Builds sample rows for the dashboard tables. Pure and deterministic: the same as-of date always gives the
// same rows and the same ids, so re-running the seed replaces rather than duplicates.
import { createHash } from "node:crypto";
import { addDays } from "../../supabase/functions/_shared/metrics/periods.ts";
import { SAMPLE_SPECS, type RestaurantSpec } from "./specs.ts";

export interface SeedRows {
  restaurants: { id: string; name: string }[];
  vendors: { id: string; restaurant_id: string; name: string }[];
  ingredients: { id: string; restaurant_id: string; name: string; unit: string; category: string; vendor_id: string }[];
  invoices: { id: string; restaurant_id: string; vendor_id: string; invoice_date: string; total_cents: number }[];
  invoice_items: { id: string; restaurant_id: string; invoice_id: string; ingredient_id: string; qty: number; unit_cost_cents: number; line_total_cents: number }[];
  menu_items: { id: string; restaurant_id: string; name: string; price_cents: number }[];
  recipe_items: { id: string; restaurant_id: string; menu_item_id: string; ingredient_id: string; qty: number }[];
  sales_items: { id: string; restaurant_id: string; sale_date: string; menu_item_id: string; units: number; sales_cents: number }[];
  inventory_counts: { id: string; restaurant_id: string; ingredient_id: string; count_date: string; qty: number }[];
  labor_entries: { id: string; restaurant_id: string; entry_date: string; labor_cents: number }[];
}

const WEEKDAY_WEIGHT = [1.2, 0.8, 0.8, 0.9, 1.0, 1.3, 1.5]; // Sun..Sat
const WEIGHT_SUM = WEEKDAY_WEIGHT.reduce((a, b) => a + b, 0);

const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Stable uuid from a label, so ids do not change between runs. */
export function stableId(...parts: string[]): string {
  const h = createHash("sha1").update(parts.join("|")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Small deterministic noise in [-1, 1] from a label and an index. */
function noise(label: string, i: number): number {
  const h = createHash("sha1").update(`${label}:${i}`).digest();
  return (h.readUInt16BE(0) / 65535) * 2 - 1;
}

export function generateSeed(asOf: string, weeks = 14): SeedRows {
  const rows: SeedRows = {
    restaurants: [], vendors: [], ingredients: [], invoices: [], invoice_items: [], menu_items: [],
    recipe_items: [], sales_items: [], inventory_counts: [], labor_entries: [],
  };
  for (const spec of SAMPLE_SPECS) generateRestaurant(spec, asOf, weeks, rows);
  return rows;
}

function generateRestaurant(spec: RestaurantSpec, asOf: string, weeks: number, rows: SeedRows) {
  const rid = spec.id;
  const id = (...p: string[]) => stableId(rid, ...p);
  const totalDays = weeks * 7;
  const start = addDays(asOf, -(totalDays - 1));
  const days = Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  rows.restaurants.push({ id: rid, name: spec.name });

  const vendorId = new Map(spec.vendors.map((v) => [v.name, id("vendor", v.name)]));
  for (const v of spec.vendors) rows.vendors.push({ id: vendorId.get(v.name)!, restaurant_id: rid, name: v.name });
  for (const ing of spec.ingredients) {
    rows.ingredients.push({
      id: id("ingredient", ing.key), restaurant_id: rid, name: ing.name, unit: ing.unit,
      category: ing.category, vendor_id: vendorId.get(ing.vendor)!,
    });
  }

  // Menu and recipes.
  for (const m of spec.menu) {
    rows.menu_items.push({ id: id("menu", m.key), restaurant_id: rid, name: m.name, price_cents: m.priceCents });
    for (const [ingKey, qty] of m.recipe) {
      rows.recipe_items.push({ id: id("recipe", m.key, ingKey), restaurant_id: rid, menu_item_id: id("menu", m.key), ingredient_id: id("ingredient", ingKey), qty });
    }
  }

  // Sales: weekday shape, light day-to-day noise, slow growth (+0.4% a week).
  const unitsByItemDay = new Map<string, number[]>();
  const salesByDay = new Array<number>(totalDays).fill(0);
  for (const m of spec.menu) {
    const perDay = days.map((d, i) => {
      const growth = 1 + 0.004 * (i / 7);
      const wobble = 1 + noise(`${rid}:${m.key}`, i) * 0.08;
      return Math.max(0, Math.round((m.weeklyUnits * WEEKDAY_WEIGHT[weekday(d)] * growth * wobble) / WEIGHT_SUM));
    });
    unitsByItemDay.set(m.key, perDay);
    days.forEach((d, i) => {
      rows.sales_items.push({ id: id("sale", m.key, d), restaurant_id: rid, sale_date: d, menu_item_id: id("menu", m.key), units: perDay[i], sales_cents: perDay[i] * m.priceCents });
      salesByDay[i] += perDay[i] * m.priceCents;
    });
  }

  // Labor: a share of each day's sales, with a rough week (week 9) where scheduling ran long.
  days.forEach((d, i) => {
    const weekIdx = Math.floor(i / 7);
    const pct = spec.laborPct * (1 + noise(`${rid}:labor`, i) * 0.06) * (weekIdx === 8 ? 1.2 : 1);
    rows.labor_entries.push({ id: id("labor", d), restaurant_id: rid, entry_date: d, labor_cents: Math.round(salesByDay[i] * pct) });
  });

  // Theoretical usage per ingredient per day (units sold x recipe), as prefix sums for range lookups.
  const theoDaily = new Map<string, number[]>();
  for (const ing of spec.ingredients) theoDaily.set(ing.key, new Array<number>(totalDays).fill(0));
  for (const m of spec.menu) {
    const perDay = unitsByItemDay.get(m.key)!;
    for (const [ingKey, qty] of m.recipe) {
      const arr = theoDaily.get(ingKey)!;
      for (let i = 0; i < totalDays; i++) arr[i] += perDay[i] * qty;
    }
  }
  const theoBetween = (key: string, fromExclusive: string, toInclusive: string) => {
    const arr = theoDaily.get(key)!;
    let sum = 0;
    for (let i = dayIndex.get(addDays(fromExclusive, 1))!; i <= dayIndex.get(toInclusive)!; i++) sum += arr[i];
    return sum;
  };
  const avgDaily = (key: string) => theoDaily.get(key)!.reduce((a, b) => a + b, 0) / totalDays;

  // Delivery dates per vendor.
  const deliveries = new Map<string, string[]>();
  for (const v of spec.vendors) deliveries.set(v.name, days.filter((d) => v.deliveryDays.includes(weekday(d))));

  // purchases[date][ingredientKey] = quantity delivered that day.
  const purchases = new Map<string, Map<string, number>>();
  const addPurchase = (date: string, key: string, qty: number) => {
    const m = purchases.get(date) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + qty);
    purchases.set(date, m);
  };

  const countDates = days.filter((d) => weekday(d) === 0);
  if (countDates[countDates.length - 1] !== asOf) countDates.push(asOf); // today's count

  for (const ing of spec.ingredients) {
    const vendorDays = deliveries.get(ing.vendor)!;
    const perWeekDeliveries = Math.max(1, spec.vendors.find((v) => v.name === ing.vendor)!.deliveryDays.length);

    if (!spec.countInventory || countDates.length < 2) {
      // No counts: buy roughly what sales need.
      for (const d of vendorDays) addPurchase(d, ing.key, r3((avgDaily(ing.key) * 7 * (1 + noise(`${rid}:${ing.key}`, dayIndex.get(d)!) * 0.05)) / perWeekDeliveries));
      continue;
    }

    // Before the first count: weekly-sized deliveries.
    for (const d of vendorDays.filter((x) => x <= countDates[0])) addPurchase(d, ing.key, r3((avgDaily(ing.key) * 7) / perWeekDeliveries));

    let stock = r3(avgDaily(ing.key) * 7 * 2.5);
    rows.inventory_counts.push({ id: id("count", ing.key, countDates[0]), restaurant_id: rid, ingredient_id: id("ingredient", ing.key), count_date: countDates[0], qty: stock });
    for (let i = 0; i < countDates.length - 1; i++) {
      const from = countDates[i];
      const to = countDates[i + 1];
      const factor = (ing.usageFactor ?? 1) * (1 + noise(`${rid}:${ing.key}:use`, i) * 0.01);
      const actual = theoBetween(ing.key, from, to) * factor;
      const inWindow = vendorDays.filter((d) => d > from && d <= to);
      let bought = inWindow.length > 0 ? actual * (1 + 0.03 * Math.sin(i * 1.7)) : 0;
      const floor = avgDaily(ing.key) * 7 * 0.25; // never count below a quarter-week of stock
      if (stock + bought - actual < floor && inWindow.length > 0) bought = actual - stock + floor;
      // Counts follow the rounded quantities the invoices will carry, so beginning + purchases - ending = usage.
      const perDelivery = inWindow.length > 0 ? r3(bought / inWindow.length) : 0;
      for (const d of inWindow) addPurchase(d, ing.key, perDelivery);
      stock = r3(Math.max(0, stock + perDelivery * inWindow.length - actual));
      rows.inventory_counts.push({ id: id("count", ing.key, to), restaurant_id: rid, ingredient_id: id("ingredient", ing.key), count_date: to, qty: stock });
    }
  }

  // Invoices: one per vendor per delivery date, priced at the unit cost in effect that day.
  const priceOn = (key: string, date: string) => {
    const ing = spec.ingredients.find((x) => x.key === key)!;
    let p = ing.unitCostCents;
    for (const c of ing.changes ?? []) if (date >= addDays(asOf, -c.daysAgo)) p *= 1 + c.pct / 100;
    return r4(p);
  };
  for (const v of spec.vendors) {
    for (const d of deliveries.get(v.name)!) {
      const bought = purchases.get(d);
      const lines = spec.ingredients.filter((ing) => ing.vendor === v.name && (bought?.get(ing.key) ?? 0) > 0);
      if (lines.length === 0) continue;
      const invoiceId = id("invoice", v.name, d);
      let total = 0;
      for (const ing of lines) {
        const qty = bought!.get(ing.key)!;
        const unitCost = priceOn(ing.key, d);
        const lineTotal = Math.round(qty * unitCost);
        total += lineTotal;
        rows.invoice_items.push({ id: id("invoice-item", v.name, d, ing.key), restaurant_id: rid, invoice_id: invoiceId, ingredient_id: id("ingredient", ing.key), qty, unit_cost_cents: unitCost, line_total_cents: lineTotal });
      }
      rows.invoices.push({ id: invoiceId, restaurant_id: rid, vendor_id: vendorId.get(v.name)!, invoice_date: d, total_cents: total });
    }
  }
}
