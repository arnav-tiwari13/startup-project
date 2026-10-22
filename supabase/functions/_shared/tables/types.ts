import type { Comparison, DateRange, MissingReason, Rating } from "../metrics/index.ts";

export const CATEGORIES = ["meat", "produce", "dairy", "dry_goods", "beverage", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  meat: "Meat", produce: "Produce", dairy: "Dairy", dry_goods: "Dry goods", beverage: "Beverage", other: "Other",
};

export const TABLE_IDS = [
  "profit_snapshot",
  "food_cost_by_category",
  "ingredient_price_changes",
  "menu_margins",
  "usage_variance",
] as const;
export type TableId = (typeof TABLE_IDS)[number];

/** How the UI formats a column's values. */
export type ColumnKind = "text" | "cents" | "cents_unit" | "pct" | "qty" | "count" | "flag";

export interface ColumnDef {
  id: string;
  label: string;
  /** Plain-language explanation shown as a tooltip on the header. */
  tooltip: string;
  kind: ColumnKind;
  defaultVisible: boolean;
  sortable: boolean;
}

export type FilterId = "vendor" | "category" | "location" | "search" | "flag" | "only_increases";
export interface FilterDef { id: FilterId; label: string; kind: "select" | "text" | "toggle" }

export interface TableDef {
  id: TableId;
  title: string;
  description: string;
  columns: ColumnDef[];
  defaultSort: { column: string; dir: "asc" | "desc" };
  /** Row grains the table can be grouped into. `null` default means ungrouped. */
  groupings: { id: string; label: string }[];
  defaultGroupBy: string | null;
  filters: FilterDef[];
}

/** One value in a table. A cell is never a guess: when data is missing, `value` is null and `missing` says why. */
export interface Cell {
  value: number | string | null;
  missing?: MissingReason;
  /** Green / yellow / red against the owner's target (shown with an icon and label, never color alone). */
  rating?: Rating;
  /** Change versus the chosen comparison, in percent or percentage points. */
  compare?: { value: number | null; unit: "pct" | "points"; missing?: MissingReason };
  /** Unit label for quantity cells (lb, each, ...). */
  unit?: string;
}

export interface Row { key: string; cells: Record<string, Cell> }

export interface TableResponse {
  tableId: TableId;
  period: DateRange;
  comparison: { kind: Comparison; range: DateRange | null };
  /** Newest data date behind this table, or null when there is no data. */
  lastUpdated: string | null;
  rows: Row[];
  total: number;
  groupBy: string | null;
  notes: string[];
  filterOptions: { vendor: string[]; category: string[]; location: { id: string; name: string }[] };
}
