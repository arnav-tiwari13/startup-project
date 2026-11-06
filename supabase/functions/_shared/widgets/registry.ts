// Every widget the AI can be asked about: what it shows, which metric definitions it uses, which tools the AI
// may call for it, starter questions, and its diagnosis playbook (a separate file per widget in ./playbooks).
// Adding a widget: add its table (tables/), a playbook file, and an entry here.
import { TABLE_DEFS } from "../tables/definitions.ts";
import { TABLE_IDS, type TableId } from "../tables/types.ts";
import dailySales from "./playbooks/daily_sales.ts";
import foodCostByCategory from "./playbooks/food_cost_by_category.ts";
import ingredientPriceChanges from "./playbooks/ingredient_price_changes.ts";
import menuMargins from "./playbooks/menu_margins.ts";
import profitSnapshot from "./playbooks/profit_snapshot.ts";
import usageVariance from "./playbooks/usage_variance.ts";

export const TOOL_NAMES = ["get_food_cost", "get_price_changes", "get_menu_margins", "get_actual_vs_theoretical", "get_sales_summary"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export type TargetKind = "widget" | "row" | "cell" | "point";

export interface WidgetDef {
  id: TableId;
  title: string;
  /** Names of the formulas in metrics/formulas.ts this widget's numbers come from. Documentation and a test target. */
  metrics: string[];
  tools: ToolName[];
  /** 3-4 questions per kind of click. `{item}` and `{column}` are filled in with the clicked row and column names. */
  questions: Record<TargetKind, string[]>;
  playbook: string;
}


export const WIDGETS: Record<TableId, WidgetDef> = {
  profit_snapshot: {
    id: "profit_snapshot", title: TABLE_DEFS.profit_snapshot.title,
    metrics: ["foodCostPct", "laborPct", "primeCostPct", "estimatedProfitCents", "pointChange", "vsTarget"],
    tools: ["get_food_cost", "get_actual_vs_theoretical", "get_sales_summary"],
    playbook: profitSnapshot,
    questions: {
      widget: ["Why is my prime cost where it is?", "What is driving food cost this period?", "Am I on track for my targets?", "What is the one thing to fix first?"],
      row: ["Why is {item} profit where it is?", "How does {item} compare with my targets?", "What changed versus the comparison?"],
      cell: ["Why is {column} what it is for {item}?", "Is {column} good or bad for {item}?", "What would move {column} the most?"],
      point: [],
    },
  },
  food_cost_by_category: {
    id: "food_cost_by_category", title: TABLE_DEFS.food_cost_by_category.title,
    metrics: ["categorySpendPct", "pctChange", "vsTarget"],
    tools: ["get_food_cost", "get_price_changes", "get_actual_vs_theoretical"],
    playbook: foodCostByCategory,
    questions: {
      widget: ["Which category is furthest over target?", "Where can I cut spend without hurting quality?", "Is spend up because of price or volume?"],
      row: ["Why is {item} spend what it is?", "What would getting {item} to target save me per month?", "Which ingredients drive {item}?"],
      cell: ["Why is {column} what it is for {item}?", "What would it take to improve {column} for {item}?", "Is {column} for {item} a concern?"],
      point: [],
    },
  },
  ingredient_price_changes: {
    id: "ingredient_price_changes", title: TABLE_DEFS.ingredient_price_changes.title,
    metrics: ["priceChangePct", "monthlyUsageQty", "monthlyPriceImpactCents"],
    tools: ["get_price_changes", "get_menu_margins"],
    playbook: ingredientPriceChanges,
    questions: {
      widget: ["Which price increases hurt me most?", "What should I do about the biggest increases?", "Which dishes are affected?"],
      row: ["Why does {item} matter this much?", "Which dishes use {item}?", "Should I switch vendors for {item}?"],
      cell: ["What does {column} mean for {item}?", "Is this change in {item} unusual?", "What can I do about {item}?"],
      point: [],
    },
  },
  menu_margins: {
    id: "menu_margins", title: TABLE_DEFS.menu_margins.title,
    metrics: ["plateCostCents", "marginCents", "marginPct", "profitContributionCents", "classifyMenuItem", "popularityThreshold"],
    tools: ["get_menu_margins", "get_price_changes", "get_sales_summary"],
    playbook: menuMargins,
    questions: {
      widget: ["Which dishes should I reprice?", "Which dishes should I promote?", "Which dishes are costing me the most?", "What am I missing to judge every dish?"],
      row: ["Should I change the price of {item}?", "How can I lower the plate cost of {item}?", "Why is {item} flagged this way?"],
      cell: ["Why is {column} what it is for {item}?", "What would improve {column} for {item}?", "Is {column} for {item} healthy?"],
      point: [],
    },
  },
  usage_variance: {
    id: "usage_variance", title: TABLE_DEFS.usage_variance.title,
    metrics: ["theoreticalUsageQty", "actualUsageQty", "varianceQty", "varianceCents", "variancePct"],
    tools: ["get_actual_vs_theoretical", "get_food_cost"],
    playbook: usageVariance,
    questions: {
      widget: ["Where am I losing the most product?", "What should I check first?", "Which items can't be measured yet?"],
      row: ["Why might {item} be over-used?", "What is {item} costing me?", "How do I check {item} this week?"],
      cell: ["What does {column} for {item} mean?", "Is {column} for {item} within normal range?", "What should I do about {item}?"],
      point: [],
    },
  },
  daily_sales: {
    id: "daily_sales", title: TABLE_DEFS.daily_sales.title,
    metrics: ["pctChange"],
    tools: ["get_sales_summary", "get_food_cost"],
    playbook: dailySales,
    questions: {
      widget: ["What does my sales pattern look like?", "Which days are weak and why might that be?", "What should I change about staffing or prep?"],
      row: ["Why were sales what they were on {item}?", "How does {item} compare with a typical day?"],
      cell: ["Why were sales what they were on {item}?", "How does {item} compare with a typical day?"],
      point: ["Why were sales what they were on {item}?", "How does {item} compare with a typical day?", "What sold on {item}?"],
    },
  },
};

/** Every table is a widget, and every widget has a table: this keeps the two lists from drifting apart. */
export const WIDGET_IDS = TABLE_IDS;

/** Starter questions for a click, with the clicked row (or date) and column names filled in. At most four. */
export function suggestedQuestions(widgetId: TableId, kind: TargetKind, item = "", column = "this value"): string[] {
  return WIDGETS[widgetId].questions[kind].map((q) => q.replaceAll("{item}", item).replaceAll("{column}", column)).slice(0, 4);
}
