import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import AnswerCard from "../../src/ai/AnswerCard.tsx";
import DataTable from "../../src/dashboard/DataTable.tsx";

const columns = TABLE_DEFS.menu_margins.columns.slice(0, 3);
const rows = [{ key: "k1", cells: { item: { value: "Burger" }, location: { value: "A" }, price: { value: 1200 } } }];
const base = { columns, rows, sort: { column: "item", dir: "asc" as const }, onSort: () => {}, busy: false };

describe("AI mode rendering", () => {
  it("makes cells keyboard-focusable buttons and adds an Ask AI button per row only in AI mode", () => {
    const off = renderToStaticMarkup(createElement(DataTable, base));
    expect(off).not.toContain("Ask AI");
    const on = renderToStaticMarkup(createElement(DataTable, { ...base, ask: { onRow: () => {}, onCell: () => {} } }));
    expect(on).toContain('tabindex="0"');
    expect(on).toContain('role="button"');
    expect(on).toContain("Ask AI about this row");
  });

  it("shows summary, evidence, actions with impact, effort and risk, save buttons, and missing data", () => {
    const html = renderToStaticMarkup(createElement(AnswerCard, {
      widgetId: "menu_margins",
      answer: {
        summary: "Burger margin is thin.", evidence: ["Plate cost $4.10"],
        actions: [{ title: "Raise price 50c", detail: "Move to $12.50.", impact_dollars: 320, impact_basis: "$0.50 x 640 units", effort: "low", risk: "Fewer orders" }],
        missing_data: ["Recipe for Fries"],
      },
    }));
    for (const t of ["Burger margin is thin.", "Plate cost $4.10", "About $320/month", "Low effort", "Risk:", "Fewer orders", "Save to action list", "Missing data", "Recipe for Fries"]) expect(html).toContain(t);
  });
});
