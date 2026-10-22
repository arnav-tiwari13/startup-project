export const PERIODS = ["last_7_days", "last_14_days", "last_28_days"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_DAYS: Record<Period, number> = { last_7_days: 7, last_14_days: 14, last_28_days: 28 };

export interface Ingredient { id: string; name: string; unit: string; vendor: string }
/** A vendor price that takes effect on `date` and stays until the next point. */
export interface PricePoint { ingredientId: string; date: string; unitCost: number }
export interface RecipeLine { ingredientId: string; qty: number }
export interface MenuItem { id: string; name: string; price: number; recipe: RecipeLine[] }
export interface DailySale { date: string; itemId: string; units: number }
/** Counted usage of an ingredient between two dates (inclusive), from inventory counts. */
export interface UsageCount { ingredientId: string; start: string; end: string; actualUsed: number }

export interface RestaurantDataset {
  restaurantId: string;
  name: string;
  /** "Today" for the dataset, YYYY-MM-DD. Periods end on this date. */
  asOf: string;
  ingredients: Ingredient[];
  prices: PricePoint[];
  menu: MenuItem[];
  sales: DailySale[];
  usage: UsageCount[];
}

/** Returned when the data needed to answer does not exist. The model is told to say so. */
export interface NoData {
  error: "no_data";
  message: string;
  needs: string;
}

export type Result<T> = T | NoData;
export const isNoData = (r: unknown): r is NoData => typeof r === "object" && r !== null && (r as NoData).error === "no_data";

export interface FoodCostResult {
  period: Period;
  start: string;
  end: string;
  sales: number;
  food_cost_dollars: number;
  food_cost_pct: number;
  /** Mock data: counted usage or recipes. Real data: what was bought on invoices in the period (same as the dashboard). */
  basis: "actual_inventory_usage" | "theoretical_from_recipes" | "invoice_purchases";
  /** Null when a sold item has no recipe or an ingredient has no price, so the figure cannot be computed. */
  theoretical_cost_dollars: number | null;
  theoretical_pct: number | null;
}

export interface PriceChange {
  ingredient: string;
  vendor: string;
  unit: string;
  old_price: number;
  new_price: number;
  change_pct: number;
  /** Mock data only: extra spend actually incurred in the period. */
  extra_cost_in_period?: number;
  /** Real data: (new - old price) x usage scaled to a 30-day month, as the dashboard computes it. */
  monthly_impact_dollars?: number | null;
}
export interface PriceChangesResult { period: Period; start: string; end: string; changes: PriceChange[]; note?: string }

export interface MarginRow { item: string; price: number; cost_per_plate: number; margin_dollars: number; margin_pct: number; food_cost_pct: number }
export interface MenuMarginsResult {
  as_of: string;
  items: MarginRow[];
  /** Real data: items left out because a recipe or ingredient price is missing, and why. */
  incomplete_items?: { item: string; reason: string }[];
}

export interface VarianceRow {
  ingredient: string; unit: string; theoretical_qty: number; actual_qty: number;
  variance_qty: number; variance_pct: number; variance_dollars: number;
}
export interface ActualVsTheoreticalResult {
  period: Period; start: string; end: string;
  theoretical_cost_dollars?: number; actual_cost_dollars?: number; gap_dollars: number;
  theoretical_pct?: number; actual_pct?: number; gap_pct_points?: number;
  ingredients: VarianceRow[];
  /** Real data: ingredients with no usable inventory counts, which are not in `ingredients`. */
  ingredients_without_counts?: string[];
  note?: string;
}

export interface SalesSummaryResult {
  period: Period; start: string; end: string;
  total_sales: number; total_units: number; avg_daily_sales: number;
  top_sellers: { item: string; units: number; revenue: number }[];
  slow_sellers: { item: string; units: number; revenue: number }[];
  best_day: { date: string; sales: number };
  worst_day: { date: string; sales: number };
  daily_totals: { date: string; sales: number }[];
}

export type MaybePromise<T> = T | Promise<T>;

/** The interface the AI tools call. Real data is async (database); the in-memory sample data answers synchronously. */
export interface RestaurantData {
  readonly restaurantId: string;
  getFoodCost(period: Period): MaybePromise<Result<FoodCostResult>>;
  getPriceChanges(period: Period): MaybePromise<Result<PriceChangesResult>>;
  getMenuMargins(): MaybePromise<Result<MenuMarginsResult>>;
  getActualVsTheoretical(period: Period): MaybePromise<Result<ActualVsTheoreticalResult>>;
  getSalesSummary(period: Period): MaybePromise<Result<SalesSummaryResult>>;
}
