import { describe, expect, it } from "vitest";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import { TABLE_IDS } from "../../supabase/functions/_shared/tables/types.ts";
import {
  defaultView, loadViewConfig, moveColumn, moveTable, resetTable, setColumnVisible, setComparison, setPeriod, setTableVisible,
  targetsInputSchema, updateTable, viewConfigSchema, viewNameSchema,
} from "../../supabase/functions/_shared/tables/view.ts";

const ids = (v: ReturnType<typeof defaultView>) => v.tables.map((t) => t.id);

describe("default view", () => {
  it("is valid, shows every table, and uses each table's default columns", () => {
    const v = defaultView();
    expect(viewConfigSchema.safeParse(v).success).toBe(true);
    expect(ids(v)).toEqual([...TABLE_IDS]);
    for (const t of v.tables) {
      expect(t.visible).toBe(true);
      expect(t.columns.filter((c) => c.visible).map((c) => c.id)).toEqual(TABLE_DEFS[t.id].columns.filter((c) => c.defaultVisible).map((c) => c.id));
    }
  });
});

describe("loadViewConfig", () => {
  it("round-trips a saved view through JSON unchanged", () => {
    let v = defaultView();
    v = moveTable(v, "menu_margins", -1);
    v = setColumnVisible(v, "menu_margins", "plate_cost", false);
    v = updateTable(v, "food_cost_by_category", { sort: { column: "pct_of_sales", dir: "desc" }, groupBy: "vendor", filters: { category: "meat" } });
    v = setPeriod(setComparison(v, "same_period_last_year"), { preset: "custom", start: "2026-09-01", end: "2026-09-30" });
    expect(loadViewConfig(JSON.parse(JSON.stringify(v)))).toEqual(v);
  });

  it("falls back to the default for anything that is not a valid view", () => {
    for (const bad of [null, undefined, 42, "x", [], {}, { version: 2 }, { version: 1, period: { preset: "someday" }, comparison: "previous_period", tables: [] }]) {
      expect(loadViewConfig(bad)).toEqual(defaultView());
    }
  });

  it("drops tables and columns that no longer exist and keeps the rest", () => {
    const stored = JSON.parse(JSON.stringify(defaultView()));
    stored.tables.push({ id: "retired_table", visible: true, columns: [], filters: {} });
    stored.tables[0].columns.push({ id: "retired_column", visible: true });
    const v = loadViewConfig(stored);
    expect(ids(v)).toEqual([...TABLE_IDS]);
    expect(v.tables[0].columns.some((c) => c.id === "retired_column")).toBe(false);
  });

  it("adds new tables and columns to an older saved layout, after the user's own order", () => {
    const stored = JSON.parse(JSON.stringify(defaultView()));
    stored.tables = stored.tables.filter((t: { id: string }) => t.id !== "usage_variance");
    stored.tables[0].columns = stored.tables[0].columns.filter((c: { id: string }) => c.id !== "est_profit");
    const v = loadViewConfig(stored);
    expect(ids(v).at(-1)).toBe("usage_variance");
    expect(v.tables[0].columns.at(-1)).toEqual({ id: "est_profit", visible: true });
  });

  it("removes a sort or grouping the table can no longer do, and dedupes columns", () => {
    const stored = JSON.parse(JSON.stringify(defaultView()));
    stored.tables[0].sort = { column: "period", dir: "asc" }; // not sortable
    stored.tables[1].groupBy = "weather";
    stored.tables[0].columns.push({ id: "sales", visible: false });
    const v = loadViewConfig(stored);
    expect(v.tables[0].sort).toBeUndefined();
    expect(v.tables[1].groupBy).toBeUndefined();
    expect(v.tables[0].columns.filter((c) => c.id === "sales")).toHaveLength(1);
  });

  it("replaces an impossible custom period and an all-hidden column list", () => {
    const stored = JSON.parse(JSON.stringify(defaultView()));
    stored.period = { preset: "custom", start: "2026-10-10", end: "2026-10-01" };
    for (const c of stored.tables[2].columns) c.visible = false;
    const v = loadViewConfig(stored);
    expect(v.period).toEqual({ preset: "last_week" });
    expect(v.tables[2].columns.some((c) => c.visible)).toBe(true);
  });

  it("rejects the same table twice and unexpected keys", () => {
    const v = defaultView();
    expect(viewConfigSchema.safeParse({ ...v, tables: [v.tables[0], v.tables[0]] }).success).toBe(false);
    expect(viewConfigSchema.safeParse({ ...v, extra: true }).success).toBe(false);
  });

  it("stays far below the database's size limit", () => {
    expect(JSON.stringify(defaultView()).length).toBeLessThan(4_000);
  });
});

describe("layout operations", () => {
  it("hides, shows and reorders tables without mutating the original", () => {
    const v = defaultView();
    const before = JSON.stringify(v);
    const moved = moveTable(v, "menu_margins", -1);
    expect(ids(moved).indexOf("menu_margins")).toBe(ids(v).indexOf("menu_margins") - 1);
    expect(setTableVisible(v, "menu_margins", false).tables.find((t) => t.id === "menu_margins")!.visible).toBe(false);
    expect(JSON.stringify(v)).toBe(before);
  });

  it("does not move past either end", () => {
    const v = defaultView();
    expect(ids(moveTable(v, TABLE_IDS[0], -1))).toEqual(ids(v));
    expect(ids(moveTable(v, TABLE_IDS[TABLE_IDS.length - 1], 1))).toEqual(ids(v));
  });

  it("shows, hides and reorders columns, but never hides the last visible one", () => {
    let v = defaultView();
    v = moveColumn(v, "profit_snapshot", "sales", -1);
    expect(v.tables[0].columns.slice(0, 3).map((c) => c.id)).toEqual(["location", "sales", "period"]);
    for (const c of TABLE_DEFS.profit_snapshot.columns) v = setColumnVisible(v, "profit_snapshot", c.id, false);
    expect(v.tables[0].columns.filter((c) => c.visible)).toHaveLength(1);
  });

  it("resets one table to its defaults and leaves the others alone", () => {
    let v = defaultView();
    v = updateTable(v, "menu_margins", { sort: { column: "price", dir: "asc" }, filters: { flag: "puzzle" } });
    v = setColumnVisible(v, "menu_margins", "price", false);
    v = setTableVisible(v, "profit_snapshot", false);
    const reset = resetTable(v, "menu_margins");
    expect(reset.tables.find((t) => t.id === "menu_margins")).toEqual(defaultView().tables.find((t) => t.id === "menu_margins"));
    expect(reset.tables.find((t) => t.id === "profit_snapshot")!.visible).toBe(false);
  });
});

describe("names and targets", () => {
  it("trims names and rejects empty or long ones", () => {
    expect(viewNameSchema.parse("  Monday ordering ")).toBe("Monday ordering");
    expect(viewNameSchema.safeParse("   ").success).toBe(false);
    expect(viewNameSchema.safeParse("x".repeat(61)).success).toBe(false);
  });

  it("accepts blank (null) targets and 0 to 100, and rejects everything else", () => {
    const ok = { food_cost_pct: 28.5, labor_pct: null, prime_cost_pct: 0, margin_pct: 100, category_targets: { meat: 11 } };
    expect(targetsInputSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, food_cost_pct: 101 }, { ...ok, labor_pct: -1 }, { ...ok, margin_pct: Number.NaN },
      { ...ok, category_targets: { candy: 5 } }, { ...ok, category_targets: { meat: 150 } }, { ...ok, extra: 1 },
    ]) expect(targetsInputSchema.safeParse(bad).success).toBe(false);
  });
});
