import { describe, expect, it } from "vitest";
import { handleChat, type AdvisorEvent } from "../../supabase/functions/_shared/advisor/handler.ts";
import { MemoryAdvisorStore } from "../../supabase/functions/_shared/advisor/memory-store.ts";
import { clickRefSchema, type ClickRefInput } from "../../supabase/functions/_shared/widgets/click.ts";
import { buildWidgetContext, renderContextBlock } from "../../supabase/functions/_shared/widgets/context.ts";
import { TOOL_NAMES, WIDGETS, suggestedQuestions } from "../../supabase/functions/_shared/widgets/registry.ts";
import * as metrics from "../../supabase/functions/_shared/metrics/index.ts";
import { TABLE_DEFS, TABLE_IDS, type TableId } from "../../supabase/functions/_shared/tables/index.ts";
import { createMockRestaurantData } from "../../supabase/functions/_shared/advisor/data-source.ts";
import { callTool, scriptedModel } from "../advisor/helpers.ts";
import { A, B, SEED, TODAY, bundleFrom, run } from "../tables/helpers.ts";

const period = { preset: "last_week" as const };
const load = async () => bundleFrom();
const build = (raw: unknown, restaurantId = A) => buildWidgetContext(raw, { restaurantId, load, today: TODAY });
const ref = (widget_id: TableId, target: ClickRefInput["target"] = { kind: "widget" }, extra: Partial<ClickRefInput> = {}): ClickRefInput =>
  ({ widget_id, target, period, comparison: "previous_period", filters: {}, ...extra });

// A row that exists in the table for restaurant A, for each widget.
function firstRow(id: TableId) {
  const res = run({ tableId: id, period, restaurantIds: [A], groupBy: id === "profit_snapshot" ? null : undefined });
  return res.rows[0];
}
const groupFor = (id: TableId) => (id === "profit_snapshot" ? { group_by: null } : {});

describe("registry", () => {
  it("has an entry for every table, with real metrics, allowed tools and a playbook", () => {
    expect(Object.keys(WIDGETS).sort()).toEqual([...TABLE_IDS].sort());
    for (const id of TABLE_IDS) {
      const w = WIDGETS[id];
      expect(w.playbook.length).toBeGreaterThan(100);
      expect(w.tools.length).toBeGreaterThan(0);
      for (const t of w.tools) expect(TOOL_NAMES).toContain(t);
      for (const m of w.metrics) expect(typeof (metrics as Record<string, unknown>)[m], `${id} uses ${m}`).toBe("function");
      expect(suggestedQuestions(id, "widget").length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe.each(TABLE_IDS)("widget %s", (id) => {
  const chart = TABLE_DEFS[id].display === "chart";
  const row = firstRow(id);
  const target: ClickRefInput["target"] = chart ? { kind: "point", date: row.key } : { kind: "row", row_key: row.key };

  it("accepts a valid whole-widget and row/point click, and rejects bad payloads", () => {
    expect(clickRefSchema.safeParse(ref(id)).success).toBe(true);
    expect(clickRefSchema.safeParse(ref(id, target)).success).toBe(true);
    const bad = [
      { ...ref(id), widget_id: "nope" },
      { ...ref(id), extra: 1 },
      { ...ref(id), target: { kind: "widget", value: 123 } },
      { ...ref(id), target: { kind: "cell", row_key: "x", column: "no_such_column" } },
      { ...ref(id), target: { kind: "row", row_key: "" } },
      { ...ref(id), target: { kind: "row", row_key: "x".repeat(121) } },
      { ...ref(id), target: { kind: "point", date: "2026-02-30" } },
      { ...ref(id), period: { preset: "custom", start: "2026-01-01" , end: "garbage" } },
      { ...ref(id), comparison: "yesterday" },
      { ...ref(id), filters: { location: "not-a-uuid" } },
      { ...ref(id), filters: { sales_cents: 99999 } },
      { ...ref(id), group_by: "nonsense" },
    ];
    for (const b of bad) expect(clickRefSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
  });

  it("builds a context whose numbers equal the table's", async () => {
    const out = await build({ ...ref(id, target), ...groupFor(id) });
    if (!out.ok) throw new Error(out.error);
    const table = run({ tableId: id, period, restaurantIds: [A], comparison: "previous_period", groupBy: id === "profit_snapshot" ? null : undefined });
    const expected = table.rows.find((r) => r.key === row.key)!;
    const got = out.context.rows[0];
    expect(got.key).toBe(row.key);
    for (const col of TABLE_DEFS[id].columns) {
      const cell = expected.cells[col.id];
      if (!cell || typeof cell.value !== "number") continue;
      const v = got.cells[col.id].value as number;
      const cents = col.kind === "cents" || col.kind === "cents_unit";
      expect(v).toBeCloseTo(cents ? cell.value / 100 : cell.value, col.kind === "pct" ? 0 : 1);
    }
    expect(out.context.period).toEqual(table.period);
    expect(renderContextBlock(out.context)).toContain("<verified_context>");
  });

  it("a whole-widget click carries the table's rows, and the chip names the widget and period", async () => {
    const out = await build({ ...ref(id), ...groupFor(id) });
    if (!out.ok) throw new Error(out.error);
    expect(out.context.rows.length).toBeGreaterThan(0);
    expect(out.context.chip.widget).toBe(WIDGETS[id].title);
    expect(out.context.chip.period).toBe(`${out.context.period.start} to ${out.context.period.end}`);
  });
});

describe("cell clicks", () => {
  it("returns the clicked row and names the column", async () => {
    const row = firstRow("menu_margins");
    const out = await build(ref("menu_margins", { kind: "cell", row_key: row.key, column: "margin_pct" }));
    if (!out.ok) throw new Error(out.error);
    expect(out.context.target.column).toBe("Margin %");
    expect(out.context.chip.target).toContain("Margin %");
    expect(out.context.rows).toHaveLength(1);
  });
});

describe("cross-restaurant safety", () => {
  const rowOfB = run({ tableId: "menu_margins", period, restaurantIds: [B] }).rows[0];
  const keyOfB = rowOfB.key; // `${B}|${itemId}`

  it("user A cannot read restaurant B's row by crafting its key", async () => {
    const out = await build(ref("menu_margins", { kind: "row", row_key: keyOfB }), A);
    expect(out).toEqual({ ok: false, error: "not_found" });
  });

  it("naming restaurant B in the location filter is refused", async () => {
    for (const id of ["profit_snapshot", "food_cost_by_category", "menu_margins"] as const) {
      expect(await build(ref(id, { kind: "widget" }, { filters: { location: B } }), A)).toEqual({ ok: false, error: "forbidden" });
    }
  });

  it("a whole-widget context for A never contains B's names, even if the loader returns everything", async () => {
    const namesA = new Set(SEED.menu_items.filter((m) => m.restaurant_id === A).map((m) => m.name));
    const onlyB = SEED.menu_items.filter((m) => m.restaurant_id === B && !namesA.has(m.name)).map((m) => m.name);
    expect(onlyB.length).toBeGreaterThan(0);
    for (const id of TABLE_IDS) {
      const out = await build({ ...ref(id), ...groupFor(id) }, A);
      if (!out.ok) throw new Error(out.error);
      const text = JSON.stringify(out.context);
      for (const n of onlyB) expect(text).not.toContain(n);
      expect(text).not.toContain(SEED.restaurants.find((r) => r.id === B)!.name);
    }
  });

  it("only ever asks the loader for the caller's own restaurant", async () => {
    const seen: string[][] = [];
    await buildWidgetContext(ref("menu_margins"), { restaurantId: A, load: async (ids) => { seen.push(ids); return bundleFrom(); }, today: TODAY });
    expect(seen).toEqual([[A]]);
  });
});

describe("the front end cannot inject numbers", () => {
  it("rejects value-like fields anywhere in the reference", () => {
    const base = ref("profit_snapshot");
    for (const bad of [
      { ...base, values: { sales: 1_000_000 } },
      { ...base, context: { sales: 1 } },
      { ...base, target: { kind: "row", row_key: A, value: 5 } },
      { ...base, target: { kind: "cell", row_key: A, column: "sales", value: 5 } },
      { ...base, period: { preset: "last_week", sales: 5 } },
      { ...base, filters: { vendor: "x", sales: 5 } },
    ]) expect(clickRefSchema.safeParse(bad).success).toBe(false);
  });

  it("the verified context ignores any number a client adds; the model only sees server-computed values", async () => {
    const real = await build({ ...ref("profit_snapshot"), group_by: null });
    const injected = await build({ ...ref("profit_snapshot"), group_by: null, sales: 99_999_999 });
    expect(real.ok).toBe(true);
    expect(injected).toEqual({ ok: false, error: "invalid" });
  });
});

// ---- Through the chat handler -----------------------------------------------------------------

function deps(script: Parameters<typeof scriptedModel>[0]) {
  const { model, calls } = scriptedModel(script);
  const store = new MemoryAdvisorStore();
  store.memberships.set("user-a", A);
  return {
    calls, store,
    deps: {
      store, model, getData: createMockRestaurantData, systemPrompt: "SYSTEM", now: () => Date.now(),
      buildContext: (raw: unknown, restaurantId: string) => buildWidgetContext(raw, { restaurantId, load, today: TODAY }),
    },
  };
}
async function chat(d: ReturnType<typeof deps>, context: unknown, message = "why?") {
  const events: AdvisorEvent[] = [];
  await handleChat(d.deps, { userId: "user-a", message, context }, (e) => events.push(e));
  return events;
}

describe("chat with a clicked widget", () => {
  const answer = {
    summary: "Food cost is above target.", evidence: ["Food cost 34%"],
    actions: [{ title: "Check portions", detail: "Weigh the top three plates.", impact_dollars: 400, impact_basis: "2 points x $20,000 sales", effort: "low", risk: "Staff pushback" }],
    missing_data: [],
  };

  it("adds the playbook and verified context to the system prompt, limits tools, and returns a structured answer", async () => {
    const d = deps([{ content: [{ type: "tool_use", id: "t1", name: "submit_answer", input: answer }], stop_reason: "tool_use" }]);
    const events = await chat(d, { ...ref("profit_snapshot"), group_by: null });
    expect(events.find((e) => e.type === "context")).toBeTruthy();
    expect(events.find((e) => e.type === "answer")).toMatchObject({ answer: { summary: answer.summary } });
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(d.store.messages.at(-1)?.content).toContain("Recommended actions");
  });

  it("offers only the widget's tools plus submit_answer, and sends the playbook and context", async () => {
    let seen: { system: string; tools: string[] } | undefined;
    const d = deps([(p: { system: string; tools: { name: string }[] }) => {
      seen = { system: p.system, tools: p.tools.map((t) => t.name) };
      return { content: [{ type: "tool_use", id: "t1", name: "submit_answer", input: answer }], stop_reason: "tool_use" };
    }] as never);
    await chat(d, { ...ref("usage_variance") });
    expect(seen!.tools.sort()).toEqual([...WIDGETS.usage_variance.tools, "submit_answer"].sort());
    expect(seen!.system).toContain("Diagnose actual versus theoretical usage");
    expect(seen!.system).toContain("<verified_context>");
  });

  it("refuses a tool the widget may not use", async () => {
    const d = deps([callTool("get_menu_margins", {}), { content: [{ type: "tool_use", id: "t2", name: "submit_answer", input: answer }], stop_reason: "tool_use" }]);
    await chat(d, { ...ref("usage_variance") });
    const toolResult = JSON.stringify(d.calls[1].messages);
    expect(toolResult).toContain("Unknown tool");
  });

  it("asks the model to retry when the answer is malformed", async () => {
    const d = deps([
      { content: [{ type: "tool_use", id: "t1", name: "submit_answer", input: { summary: "x" } }], stop_reason: "tool_use" },
      { content: [{ type: "tool_use", id: "t2", name: "submit_answer", input: answer }], stop_reason: "tool_use" },
    ]);
    const events = await chat(d, { ...ref("profit_snapshot"), group_by: null });
    expect(events.filter((e) => e.type === "answer")).toHaveLength(1);
    expect(JSON.stringify(d.calls[1].messages)).toContain("Invalid answer");
  });

  it("rejects a bad or crafted reference with one generic error, before any model call or stored message", async () => {
    const rowOfB = run({ tableId: "menu_margins", period, restaurantIds: [B] }).rows[0].key;
    for (const bad of [{ nonsense: true }, "text", ref("menu_margins", { kind: "row", row_key: rowOfB }), ref("menu_margins", { kind: "widget" }, { filters: { location: B } })]) {
      const d = deps([]);
      const events = await chat(d, bad);
      const err = events.find((e) => e.type === "error");
      expect(err).toMatchObject({ code: "bad_context" });
      expect(d.calls).toHaveLength(0);
      expect(d.store.messages).toHaveLength(0);
      expect(d.store.conversations).toHaveLength(0);
    }
  });
});
