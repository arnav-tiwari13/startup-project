// Builds what the browser sends when something is clicked in AI mode: a reference (widget, target, period,
// comparison, filters) and never a data value. The chip text shown before the server replies is built here from
// the same reference plus labels already on screen; the server's own chip replaces it once the first reply starts.
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import type { TableId } from "../../supabase/functions/_shared/tables/types.ts";
import type { Chip } from "../../supabase/functions/_shared/widgets/context.ts";
import type { ClickRefInput } from "../../supabase/functions/_shared/widgets/click.ts";
import { suggestedQuestions, WIDGETS } from "../../supabase/functions/_shared/widgets/registry.ts";
import type { TableRequestInput } from "../dashboard/api";

export type Target = ClickRefInput["target"];
export interface Asked { ref: ClickRefInput; chip: Chip; questions: string[] }

const COMPARISON_TEXT = { previous_period: "vs previous period", same_period_last_year: "vs same period last year", target: "vs your targets" } as const;

/** The reference for a click. Only ids, dates, a column name and the view's own settings go in. */
export function buildRef(widgetId: TableId, target: Target, request: Pick<TableRequestInput, "period" | "comparison" | "filters" | "groupBy">): ClickRefInput {
  return {
    widget_id: widgetId,
    target,
    period: request.period ?? { preset: "last_week" },
    comparison: request.comparison ?? "previous_period",
    filters: request.filters ?? {},
    ...(request.groupBy !== undefined ? { group_by: request.groupBy } : {}),
  };
}

/** `item` is the clicked row's name (or the date) as shown on screen; `periodText` is the period as shown on screen. */
export function buildAsked(ref: ClickRefInput, labels: { item?: string; column?: string; periodText: string }): Asked {
  const def = TABLE_DEFS[ref.widget_id];
  const t = ref.target;
  const target =
    t.kind === "widget" ? "Whole widget"
    : t.kind === "row" ? `Row: ${labels.item ?? "selected row"}`
    : t.kind === "cell" ? `${labels.column ?? "Value"} for ${labels.item ?? "selected row"}`
    : `Day: ${t.date}`;
  const filters = Object.entries(ref.filters ?? {})
    .filter(([k, v]) => k !== "location" && v !== undefined && v !== false && v !== "")
    .map(([k, v]) => (k === "only_increases" ? "Only increases" : `${k[0].toUpperCase()}${k.slice(1)}: ${v}`));
  return {
    ref,
    chip: { widget: WIDGETS[ref.widget_id].title ?? def.title, target, period: labels.periodText, comparison: COMPARISON_TEXT[ref.comparison], filters },
    questions: suggestedQuestions(ref.widget_id, t.kind, labels.item ?? "", labels.column),
  };
}
