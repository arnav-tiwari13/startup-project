// What the browser may send when the user clicks something in AI mode: references only, never data values.
// Strict schemas reject unknown fields, so a number smuggled into the request is an error, not context.
import { z } from "zod";
import { COMPARISONS, isIsoDate } from "../metrics/index.ts";
import { TABLE_DEFS } from "../tables/definitions.ts";
import { filtersSchema, periodSchema } from "../tables/schema.ts";
import { TABLE_IDS } from "../tables/types.ts";

// A row key is one of the table's own keys (a uuid pair, a category, a date, a group label). It is only ever compared
// with keys the server computed, never put into a query or into the prompt, so the check is about size and shape.
const noControlChars = (s: string) => !/[\u0000-\u001f\u007f]/.test(s);
const rowKey = z.string().min(1).max(120).refine(noControlChars, "invalid row");
const isoDate = z.string().refine(isIsoDate, "must be a real YYYY-MM-DD date");

export const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("widget") }).strict(),
  z.object({ kind: z.literal("row"), row_key: rowKey }).strict(),
  z.object({ kind: z.literal("cell"), row_key: rowKey, column: z.string().min(1).max(40) }).strict(),
  z.object({ kind: z.literal("point"), date: isoDate }).strict(),
]);

export const clickRefSchema = z
  .object({
    widget_id: z.enum(TABLE_IDS),
    target: targetSchema,
    period: periodSchema,
    comparison: z.enum(COMPARISONS),
    filters: filtersSchema.default({}),
    group_by: z.string().min(1).max(20).nullable().optional(),
  })
  .strict()
  .superRefine((ref, ctx) => {
    const def = TABLE_DEFS[ref.widget_id];
    const t = ref.target;
    if (t.kind === "cell" && !def.columns.some((c) => c.id === t.column)) {
      ctx.addIssue({ code: "custom", message: "unknown column", path: ["target", "column"] });
    }
    if (t.kind === "point" && def.display !== "chart") {
      ctx.addIssue({ code: "custom", message: "this widget has no data points", path: ["target", "kind"] });
    }
    if (def.display === "chart" && (t.kind === "row" || t.kind === "cell")) {
      ctx.addIssue({ code: "custom", message: "click a point on a chart", path: ["target", "kind"] });
    }
    if (ref.group_by !== undefined && ref.group_by !== null && !def.groupings.some((g) => g.id === ref.group_by)) {
      ctx.addIssue({ code: "custom", message: "unknown grouping", path: ["group_by"] });
    }
  });

export type ClickRef = z.infer<typeof clickRefSchema>;
export type ClickRefInput = z.input<typeof clickRefSchema>;
