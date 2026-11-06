import { describe, expect, it } from "vitest";
import { clickRefSchema } from "../../supabase/functions/_shared/widgets/click.ts";
import { buildAsked, buildRef } from "../../src/ai/ref.ts";

const request = { period: { preset: "last_week" as const }, comparison: "previous_period" as const, filters: { vendor: "Acme" }, groupBy: undefined };

describe("what the browser sends", () => {
  it("builds references that the server schema accepts, for each click kind", () => {
    for (const target of [{ kind: "widget" }, { kind: "row", row_key: "a|b" }, { kind: "cell", row_key: "a|b", column: "margin_pct" }] as const) {
      expect(clickRefSchema.safeParse(buildRef("menu_margins", target, request)).success).toBe(true);
    }
    expect(clickRefSchema.safeParse(buildRef("daily_sales", { kind: "point", date: "2026-10-12" }, { ...request, filters: {} })).success).toBe(true);
  });

  it("carries only ids, dates, the column id and view settings, never a data value", () => {
    const ref = buildRef("menu_margins", { kind: "cell", row_key: "a|b", column: "margin_pct" }, request);
    expect(Object.keys(ref).sort()).toEqual(["comparison", "filters", "period", "target", "widget_id"]);
    expect(JSON.stringify(ref)).not.toMatch(/\d{3,}\.\d|price|cents/);
  });

  it("builds the chip and starter questions from the clicked labels", () => {
    const a = buildAsked(buildRef("menu_margins", { kind: "cell", row_key: "k", column: "margin_pct" }, request), { item: "Burger", column: "Margin %", periodText: "Oct 12 – Oct 18" });
    expect(a.chip).toMatchObject({ widget: "Menu margins", target: "Margin % for Burger", comparison: "vs previous period", filters: ["Vendor: Acme"] });
    expect(a.questions.length).toBeGreaterThanOrEqual(3);
    expect(a.questions.length).toBeLessThanOrEqual(4);
    expect(a.questions.join(" ")).toContain("Burger");
  });
});
