/** Why a number could not be computed. The UI shows a "missing data" state for these instead of a wrong number. */
export type MissingReason =
  | "no_sales"
  | "no_price"
  | "no_previous_period"
  | "no_recipe"
  | "missing_price"
  | "missing_inventory_count"
  | "no_theoretical_usage"
  | "no_target"
  | "invalid_input";

export type Metric = { ok: true; value: number } | { ok: false; reason: MissingReason };

export const ok = (value: number): Metric => ({ ok: true, value });
export const missing = (reason: MissingReason): Metric => ({ ok: false, reason });
export const isOk = (m: Metric): m is { ok: true; value: number } => m.ok;

export const MISSING_LABEL: Record<MissingReason, string> = {
  no_sales: "No sales in this period",
  no_price: "No menu price set",
  no_previous_period: "Nothing to compare to",
  no_recipe: "Recipe is missing",
  missing_price: "An ingredient price is missing",
  missing_inventory_count: "Inventory count is missing",
  no_theoretical_usage: "No expected usage to compare against",
  no_target: "No target set",
  invalid_input: "Data looks wrong",
};
