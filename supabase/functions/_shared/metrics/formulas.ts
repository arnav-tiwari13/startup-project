// Every metric formula lives here, once. Tables, CSV export and the AI advisor import from this file.
// Do not re-implement any of these in a UI component.
//
// Units: money is whole cents. Unit prices (cost per ounce, per lb, ...) are cents and may be fractional,
// because real unit prices are; every line total or plate cost is rounded to whole cents.
// Percentages are plain numbers (31.5 means 31.5%), unrounded: round only when displaying.
import { isOk, missing, ok, type Metric } from "./result.ts";

const finite = (...ns: number[]) => ns.every((n) => Number.isFinite(n));

/** numerator / denominator as a percent, or missing when the denominator is not positive. */
const ratioPct = (numerator: number, denominator: number, whenZero: "no_sales" | "no_price"): Metric => {
  if (!finite(numerator, denominator)) return missing("invalid_input");
  if (denominator <= 0) return missing(whenZero);
  return ok((numerator / denominator) * 100);
};

// ---- Profit snapshot -------------------------------------------------------------------------

/** food_cost_pct = food cost / sales */
export const foodCostPct = (foodCostCents: number, salesCents: number) => ratioPct(foodCostCents, salesCents, "no_sales");

/** labor_pct = labor cost / sales */
export const laborPct = (laborCents: number, salesCents: number) => ratioPct(laborCents, salesCents, "no_sales");

/** prime_cost_pct = (food cost + labor cost) / sales */
export const primeCostPct = (foodCostCents: number, laborCents: number, salesCents: number) =>
  ratioPct(foodCostCents + laborCents, salesCents, "no_sales");

/** Estimated profit = sales - food cost - labor. Rent, fees and other costs are not included, hence "estimated". */
export const estimatedProfitCents = (salesCents: number, foodCostCents: number, laborCents: number): Metric =>
  finite(salesCents, foodCostCents, laborCents) ? ok(salesCents - foodCostCents - laborCents) : missing("invalid_input");

// ---- Comparisons and targets -----------------------------------------------------------------

/** Percent change from previous to current. Missing when previous is zero (a percent of nothing). */
export const pctChange = (current: number, previous: number): Metric => {
  if (!finite(current, previous)) return missing("invalid_input");
  if (previous === 0) return missing("no_previous_period");
  return ok(((current - previous) / Math.abs(previous)) * 100);
};

/** Change in percentage points between two percent metrics (e.g. food cost 32% -> 30% is -2). */
export const pointChange = (current: Metric, previous: Metric): Metric => {
  if (!isOk(current)) return current;
  if (!isOk(previous)) return missing("no_previous_period");
  return ok(current.value - previous.value);
};

/** Distance from the owner's target, in the metric's own units. Positive means above target. */
export const vsTarget = (value: Metric, target: number | null | undefined): Metric => {
  if (!isOk(value)) return value;
  if (target === null || target === undefined) return missing("no_target");
  return Number.isFinite(target) ? ok(value.value - target) : missing("invalid_input");
};

export type Direction = "lower_is_better" | "higher_is_better";
export type Rating = "good" | "watch" | "bad" | "unknown";

/**
 * Green / yellow / red against a target. `warnBand` is how far past the target still counts as "watch"
 * (0.1 = within 10% of the target). A missing value or target is "unknown", never a guess.
 */
export const rateAgainstTarget = (
  value: Metric,
  target: number | null | undefined,
  direction: Direction,
  warnBand = 0.1,
): Rating => {
  if (!isOk(value) || target === null || target === undefined || !Number.isFinite(target)) return "unknown";
  const v = value.value;
  if (direction === "lower_is_better") return v <= target ? "good" : v <= target * (1 + warnBand) ? "watch" : "bad";
  return v >= target ? "good" : v >= target * (1 - warnBand) ? "watch" : "bad";
};

// ---- Food cost by category -------------------------------------------------------------------

/** category_pct_of_sales = category spend / sales */
export const categorySpendPct = (spendCents: number, salesCents: number) => ratioPct(spendCents, salesCents, "no_sales");

// ---- Ingredient price changes ----------------------------------------------------------------

/** price_change_pct = (current price - previous price) / previous price */
export const priceChangePct = (previousUnitCost: number, currentUnitCost: number) => pctChange(currentUnitCost, previousUnitCost);

/** Usage scaled to a 30-day month, from the quantity used over `windowDays`. */
export const monthlyUsageQty = (qtyInWindow: number, windowDays: number): Metric =>
  finite(qtyInWindow, windowDays) && windowDays > 0 && qtyInWindow >= 0 ? ok((qtyInWindow / windowDays) * 30) : missing("invalid_input");

/** Extra (or saved) cents per month: (current - previous unit price) x monthly usage. */
export const monthlyPriceImpactCents = (previousUnitCost: number, currentUnitCost: number, monthlyQty: Metric): Metric => {
  if (!isOk(monthlyQty)) return monthlyQty;
  if (!finite(previousUnitCost, currentUnitCost)) return missing("invalid_input");
  return ok(Math.round((currentUnitCost - previousUnitCost) * monthlyQty.value));
};

// ---- Menu margins ----------------------------------------------------------------------------

/** plate cost = sum of (quantity x unit cost) over the recipe. Missing recipe or any missing price means missing, never a partial sum. */
export const plateCostCents = (lines: { qty: number; unitCostCents: number | undefined }[]): Metric => {
  if (lines.length === 0) return missing("no_recipe");
  let total = 0;
  for (const l of lines) {
    if (l.unitCostCents === undefined) return missing("missing_price");
    if (!finite(l.qty, l.unitCostCents) || l.qty < 0) return missing("invalid_input");
    total += l.qty * l.unitCostCents;
  }
  return ok(Math.round(total));
};

/** margin $ = menu price - plate cost */
export const marginCents = (priceCents: number, plateCost: Metric): Metric => {
  if (!isOk(plateCost)) return plateCost;
  if (!Number.isFinite(priceCents)) return missing("invalid_input");
  if (priceCents <= 0) return missing("no_price");
  return ok(priceCents - plateCost.value);
};

/** margin % = margin $ / menu price */
export const marginPct = (priceCents: number, margin: Metric): Metric => {
  if (!isOk(margin)) return margin;
  return ratioPct(margin.value, priceCents, "no_price");
};

/** profit contribution = margin $ x units sold */
export const profitContributionCents = (margin: Metric, unitsSold: number): Metric => {
  if (!isOk(margin)) return margin;
  return Number.isFinite(unitsSold) && unitsSold >= 0 ? ok(Math.round(margin.value * unitsSold)) : missing("invalid_input");
};

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog" | "unknown";

/** An item counts as popular when it sells at least 70% of an even share of all units (classic menu engineering). */
export const popularityThreshold = (totalUnits: number, itemCount: number): number =>
  itemCount > 0 && totalUnits > 0 ? (0.7 * totalUnits) / itemCount : 0;

/**
 * star = high margin, high sales. plowhorse = LOW margin, HIGH sales (flag: reprice or cut cost).
 * puzzle = HIGH margin, LOW sales (flag: promote it). dog = low margin, low sales.
 */
export const classifyMenuItem = (margin: Metric, unitsSold: number, targetMarginPct: number | null | undefined, popularityMin: number): MenuClass => {
  if (!isOk(margin) || targetMarginPct === null || targetMarginPct === undefined || !Number.isFinite(unitsSold)) return "unknown";
  const highMargin = margin.value >= targetMarginPct;
  const highSales = unitsSold >= popularityMin;
  return highMargin ? (highSales ? "star" : "puzzle") : highSales ? "plowhorse" : "dog";
};

// ---- Actual vs. theoretical usage ------------------------------------------------------------

/** theoretical usage = sum of (units sold x recipe quantity). A sold item with no recipe makes it missing, since it would be understated. */
export const theoreticalUsageQty = (lines: { unitsSold: number; qtyPerUnit: number | undefined }[]): Metric => {
  let total = 0;
  for (const l of lines) {
    if (l.qtyPerUnit === undefined) return missing("no_recipe");
    if (!finite(l.unitsSold, l.qtyPerUnit)) return missing("invalid_input");
    total += l.unitsSold * l.qtyPerUnit;
  }
  return ok(total);
};

/** actual usage = beginning inventory + purchases - ending inventory. A negative result means a bad count, so it is missing. */
export const actualUsageQty = (beginning: number | null | undefined, purchases: number, ending: number | null | undefined): Metric => {
  if (beginning === null || beginning === undefined || ending === null || ending === undefined) return missing("missing_inventory_count");
  if (!finite(beginning, purchases, ending)) return missing("invalid_input");
  const used = beginning + purchases - ending;
  return used < 0 ? missing("invalid_input") : ok(used);
};

/** variance (units) = actual - theoretical. Positive means more was used than sales explain. */
export const varianceQty = (actual: Metric, theoretical: Metric): Metric => {
  if (!isOk(actual)) return actual;
  if (!isOk(theoretical)) return theoretical;
  return ok(actual.value - theoretical.value);
};

/** variance ($) = variance (units) x unit cost */
export const varianceCents = (variance: Metric, unitCostCents: number | undefined): Metric => {
  if (!isOk(variance)) return variance;
  if (unitCostCents === undefined) return missing("missing_price");
  return Number.isFinite(unitCostCents) ? ok(Math.round(variance.value * unitCostCents)) : missing("invalid_input");
};

/** variance % = variance (units) / theoretical usage */
export const variancePct = (variance: Metric, theoretical: Metric): Metric => {
  if (!isOk(variance)) return variance;
  if (!isOk(theoretical)) return theoretical;
  return theoretical.value > 0 ? ok((variance.value / theoretical.value) * 100) : missing("no_theoretical_usage");
};
