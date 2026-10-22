import { PERIODS, type RestaurantData } from "./types.ts";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };
}

const periodProp = {
  type: "string",
  enum: [...PERIODS],
  description: "Window ending today: last_7_days, last_14_days or last_28_days.",
};
const withPeriod = { type: "object" as const, properties: { period: periodProp }, required: ["period"], additionalProperties: false as const };

// Tools take no restaurant identifier. The business is fixed server-side from the signed-in user.
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_food_cost",
    description: "Food cost as a percent of sales and in dollars for a period (what was bought on invoices in the period, same as the dashboard). Also returns the theoretical (recipe-based) cost when recipes and prices allow it.",
    input_schema: withPeriod,
  },
  {
    name: "get_price_changes",
    description: "Ingredients whose vendor price changed during the period, with the vendor, old and new price, percent change and the estimated extra cost per month.",
    input_schema: withPeriod,
  },
  {
    name: "get_menu_margins",
    description: "Cost per plate, price, margin and food cost percent for every menu item at current ingredient prices.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_actual_vs_theoretical",
    description: "The gap between the ingredients recipes say should have been used and what inventory counts show was used, per ingredient, in quantity and dollars.",
    input_schema: withPeriod,
  },
  {
    name: "get_sales_summary",
    description: "Total sales, top sellers by revenue, slow sellers by units, best and worst days and daily totals for a period.",
    input_schema: withPeriod,
  },
];

export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: string };

const isPeriod = (v: unknown): v is (typeof PERIODS)[number] => typeof v === "string" && (PERIODS as readonly string[]).includes(v);

/** Validates the model's input strictly, then runs the tool against the already-scoped data source. */
export async function executeTool(data: RestaurantData, name: string, input: unknown): Promise<ToolOutcome> {
  const def = TOOL_DEFINITIONS.find((t) => t.name === name);
  if (!def) return { ok: false, error: `Unknown tool: ${name}` };
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "Tool input must be an object." };

  const allowed = Object.keys(def.input_schema.properties);
  const extra = Object.keys(input).filter((k) => !allowed.includes(k));
  if (extra.length) {
    return { ok: false, error: `Unexpected field(s): ${extra.join(", ")}. Tools are already scoped to the signed-in business.` };
  }

  try {
    return await run(data, name, input);
  } catch (err) {
    // Never pass database error text to the model; it can name tables or columns.
    console.error("advisor tool failed:", name, err instanceof Error ? err.name : "error");
    return { ok: false, error: "The data could not be loaded right now. Try again in a moment." };
  }
}

async function run(data: RestaurantData, name: string, input: object): Promise<ToolOutcome> {
  if (name === "get_menu_margins") return { ok: true, result: await data.getMenuMargins() };

  const period = (input as { period?: unknown }).period;
  if (!isPeriod(period)) return { ok: false, error: `period must be one of: ${PERIODS.join(", ")}.` };
  switch (name) {
    case "get_food_cost": return { ok: true, result: await data.getFoodCost(period) };
    case "get_price_changes": return { ok: true, result: await data.getPriceChanges(period) };
    case "get_actual_vs_theoretical": return { ok: true, result: await data.getActualVsTheoretical(period) };
    case "get_sales_summary": return { ok: true, result: await data.getSalesSummary(period) };
    default: return { ok: false, error: `Unknown tool: ${name}` };
  }
}
