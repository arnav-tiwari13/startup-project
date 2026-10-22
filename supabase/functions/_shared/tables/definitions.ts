// Table definitions are configuration: adding a table means adding an entry here plus a compute function
// in compute.ts and a line in registry.ts. The UI is generated from this file, so it needs no changes.
import type { TableDef, TableId } from "./types.ts";

const LOCATION = { id: "location", label: "Location", tooltip: "Which of your locations this row is for.", kind: "text", defaultVisible: false, sortable: true } as const;

export const TABLE_DEFS: Record<TableId, TableDef> = {
  profit_snapshot: {
    id: "profit_snapshot",
    title: "Profit snapshot",
    description: "Sales, food and labor cost, and what is left, for the period.",
    defaultSort: { column: "location", dir: "asc" },
    groupings: [{ id: "location", label: "Each location" }],
    defaultGroupBy: "location",
    ungroupedLabel: "All locations combined",
    filters: [{ id: "location", label: "Location", kind: "select" }],
    columns: [
      { id: "location", label: "Location", tooltip: "Which location. \"All locations\" adds them together.", kind: "text", defaultVisible: true, sortable: true },
      { id: "period", label: "Period", tooltip: "The dates this row covers.", kind: "text", defaultVisible: true, sortable: false },
      { id: "sales", label: "Sales", tooltip: "Everything you sold in the period, from your sales data.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "food_cost", label: "Food cost $", tooltip: "What you spent on food and supplies, from the invoices dated in this period.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "food_cost_pct", label: "Food cost %", tooltip: "Food cost divided by sales. Lower is better.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "labor", label: "Labor $", tooltip: "Wages and labor cost entered for the period.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "labor_pct", label: "Labor %", tooltip: "Labor cost divided by sales. Lower is better.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "prime_cost_pct", label: "Prime cost %", tooltip: "Food cost plus labor cost, divided by sales. The single best health check for a restaurant.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "est_profit", label: "Est. profit", tooltip: "Sales minus food cost minus labor. Rent, fees and other costs are not included, so real profit is lower.", kind: "cents", defaultVisible: true, sortable: true },
    ],
  },

  food_cost_by_category: {
    id: "food_cost_by_category",
    title: "Food cost by category",
    description: "Where the food money goes, as a share of sales.",
    defaultSort: { column: "spend", dir: "desc" },
    groupings: [{ id: "category", label: "Category" }, { id: "vendor", label: "Vendor" }, { id: "location", label: "Location" }],
    defaultGroupBy: "category",
    filters: [
      { id: "vendor", label: "Vendor", kind: "select" },
      { id: "category", label: "Category", kind: "select" },
      { id: "location", label: "Location", kind: "select" },
    ],
    columns: [
      { id: "group", label: "Group", tooltip: "The category, vendor or location this row adds up, depending on how you group.", kind: "text", defaultVisible: true, sortable: true },
      { id: "spend", label: "Spend", tooltip: "Total on invoices dated in the period.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "pct_of_sales", label: "% of sales", tooltip: "Spend divided by sales for the same locations. Lower is better.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "target_pct", label: "Target %", tooltip: "Your target for this category as a share of sales. Set targets in Targets.", kind: "pct", defaultVisible: true, sortable: true },
    ],
  },

  ingredient_price_changes: {
    id: "ingredient_price_changes",
    title: "Ingredient price changes",
    description: "Which prices moved, and what the move costs you each month.",
    defaultSort: { column: "monthly_impact", dir: "desc" },
    groupings: [{ id: "vendor", label: "Vendor" }, { id: "category", label: "Category" }],
    defaultGroupBy: null,
    ungroupedLabel: "Each ingredient",
    filters: [
      { id: "vendor", label: "Vendor", kind: "select" },
      { id: "category", label: "Category", kind: "select" },
      { id: "location", label: "Location", kind: "select" },
      { id: "search", label: "Search item", kind: "text" },
      { id: "only_increases", label: "Only increases", kind: "toggle" },
    ],
    columns: [
      { id: "item", label: "Item", tooltip: "The ingredient.", kind: "text", defaultVisible: true, sortable: true },
      LOCATION,
      { id: "vendor", label: "Vendor", tooltip: "Who you buy it from.", kind: "text", defaultVisible: true, sortable: true },
      { id: "previous_price", label: "Previous price", tooltip: "The last price you paid before this period started.", kind: "cents_unit", defaultVisible: true, sortable: true },
      { id: "current_price", label: "Current price", tooltip: "The most recent price you paid in this period.", kind: "cents_unit", defaultVisible: true, sortable: true },
      { id: "change_pct", label: "% change", tooltip: "Current price minus previous price, divided by previous price.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "monthly_impact", label: "Monthly impact", tooltip: "Price change times how much you buy in a month (your last 28 days of purchases, scaled to 30 days). Positive means it costs you more.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "items", label: "Items", tooltip: "How many ingredients are in this group.", kind: "count", defaultVisible: false, sortable: true },
    ],
  },

  menu_margins: {
    id: "menu_margins",
    title: "Menu margins",
    description: "Which dishes make money, and which are busy but thin.",
    defaultSort: { column: "profit_contribution", dir: "desc" },
    groupings: [],
    defaultGroupBy: null,
    filters: [
      { id: "location", label: "Location", kind: "select" },
      { id: "flag", label: "Flag", kind: "select" },
      { id: "search", label: "Search dish", kind: "text" },
    ],
    columns: [
      { id: "item", label: "Menu item", tooltip: "The dish on your menu.", kind: "text", defaultVisible: true, sortable: true },
      LOCATION,
      { id: "price", label: "Menu price", tooltip: "What you charge.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "plate_cost", label: "Plate cost", tooltip: "Cost of everything in the recipe at your latest ingredient prices. Missing if the recipe or a price is missing.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "margin_dollars", label: "Margin $", tooltip: "Menu price minus plate cost.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "margin_pct", label: "Margin %", tooltip: "Margin divided by menu price. Higher is better.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "units_sold", label: "Units sold", tooltip: "How many you sold in the period.", kind: "count", defaultVisible: true, sortable: true },
      { id: "profit_contribution", label: "Profit contribution", tooltip: "Margin $ times units sold: how much this dish adds to profit before labor and other costs.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "flag", label: "Flag", tooltip: "Low margin with high sales: reprice it or trim the portion. High margin with low sales: promote it.", kind: "flag", defaultVisible: true, sortable: true },
    ],
  },

  usage_variance: {
    id: "usage_variance",
    title: "Actual vs. theoretical usage",
    description: "How much you used compared with what your sales say you should have used.",
    defaultSort: { column: "variance_dollars", dir: "desc" },
    groupings: [{ id: "vendor", label: "Vendor" }, { id: "category", label: "Category" }, { id: "location", label: "Location" }],
    defaultGroupBy: null,
    ungroupedLabel: "Each ingredient",
    filters: [
      { id: "vendor", label: "Vendor", kind: "select" },
      { id: "category", label: "Category", kind: "select" },
      { id: "location", label: "Location", kind: "select" },
      { id: "search", label: "Search item", kind: "text" },
    ],
    columns: [
      { id: "item", label: "Item", tooltip: "The ingredient.", kind: "text", defaultVisible: true, sortable: true },
      LOCATION,
      { id: "vendor", label: "Vendor", tooltip: "Who you buy it from.", kind: "text", defaultVisible: false, sortable: true },
      { id: "theoretical_qty", label: "Theoretical", tooltip: "What your sales and recipes say you should have used.", kind: "qty", defaultVisible: true, sortable: true },
      { id: "actual_qty", label: "Actual", tooltip: "Beginning count plus what you bought, minus ending count.", kind: "qty", defaultVisible: true, sortable: true },
      { id: "variance_qty", label: "Variance (units)", tooltip: "Actual minus theoretical. Positive means more went out the door than sales explain: waste, over-portioning or theft.", kind: "qty", defaultVisible: true, sortable: true },
      { id: "variance_dollars", label: "Variance $", tooltip: "Variance in units times the ingredient's latest price.", kind: "cents", defaultVisible: true, sortable: true },
      { id: "variance_pct", label: "Variance %", tooltip: "Variance divided by theoretical usage.", kind: "pct", defaultVisible: true, sortable: true },
      { id: "items", label: "Items", tooltip: "How many ingredients are in this group.", kind: "count", defaultVisible: false, sortable: true },
    ],
  },
};

export const tableDef = (id: TableId): TableDef => TABLE_DEFS[id];
