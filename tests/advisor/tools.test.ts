import { describe, expect, it } from "vitest";
import { executeTool, TOOL_DEFINITIONS } from "../../supabase/functions/_shared/advisor/tools.ts";
import { isNoData } from "../../supabase/functions/_shared/advisor/types.ts";
import { createMockRestaurantData } from "../../supabase/functions/_shared/advisor/data-source.ts";
import { SAMPLE_RESTAURANT_ID_2 } from "../../supabase/functions/_shared/advisor/mock-data.ts";
import { miniData } from "./helpers.ts";

const a = miniData("rest-a");

describe("get_food_cost", () => {
  it("computes sales, theoretical and actual food cost", () => {
    const r = a.getFoodCost("last_7_days");
    if (isNoData(r)) throw new Error("expected data");
    expect(r.sales).toBe(840); // 70 burgers x $10 + 35 sliders x $4
    expect(r.theoretical_cost_dollars).toBe(298.5); // 37.50 on 01-09, 43.50 x 6 days
    expect(r.theoretical_pct).toBe(35.5);
    expect(r.basis).toBe("actual_inventory_usage");
    expect(r.food_cost_dollars).toBeCloseTo(316.07, 2); // 45 lb beef at weighted $5.857 + 105 buns
    expect(r.food_cost_pct).toBe(37.6);
  });

  it("falls back to recipe cost when counts do not cover the whole period", () => {
    const r = a.getFoodCost("last_14_days");
    if (isNoData(r)) throw new Error("expected data");
    expect(r.basis).toBe("theoretical_from_recipes");
    expect(r.food_cost_dollars).toBe(298.5);
  });
});

describe("get_price_changes", () => {
  it("lists changed ingredients with percent and extra cost", () => {
    const r = a.getPriceChanges("last_7_days");
    if (isNoData(r)) throw new Error("expected data");
    expect(r.changes).toHaveLength(1); // buns did not change
    expect(r.changes[0]).toMatchObject({ ingredient: "Ground beef", vendor: "Acme Meats", old_price: 5, new_price: 6, change_pct: 20 });
    expect(r.changes[0].extra_cost_in_period).toBe(36); // 6 days x 6 lb x $1
  });

  it("says nothing changed when nothing did", () => {
    const r = miniData("rest-b").getPriceChanges("last_7_days");
    if (isNoData(r)) throw new Error("expected data");
    expect(r.changes).toEqual([]);
    expect(r.note).toMatch(/no ingredient prices changed/i);
  });
});

describe("get_menu_margins", () => {
  it("costs each item at current prices and sorts worst first", () => {
    const r = a.getMenuMargins();
    if (isNoData(r)) throw new Error("expected data");
    expect(r.items.map((i) => i.item)).toEqual(["Slider", "Burger"]);
    expect(r.items[1]).toMatchObject({ item: "Burger", cost_per_plate: 3.5, margin_dollars: 6.5, margin_pct: 65, food_cost_pct: 35 });
    expect(r.items[0]).toMatchObject({ item: "Slider", cost_per_plate: 1.7, margin_dollars: 2.3, margin_pct: 57.5, food_cost_pct: 42.5 });
  });
});

describe("get_actual_vs_theoretical", () => {
  it("finds the over-used ingredient", () => {
    const r = a.getActualVsTheoretical("last_7_days");
    if (isNoData(r)) throw new Error("expected data");
    const beef = r.ingredients.find((i) => i.ingredient === "Ground beef")!;
    expect(beef).toMatchObject({ theoretical_qty: 42, actual_qty: 45, variance_qty: 3, variance_pct: 7.1 });
    expect(beef.variance_dollars).toBeCloseTo(17.57, 2);
    expect(r.ingredients[0].ingredient).toBe("Ground beef"); // biggest dollar gap first
    expect(r.theoretical_pct).toBe(35.5);
    expect(r.actual_pct).toBe(37.6);
    expect(r.gap_pct_points).toBe(2.1);
    expect(r.gap_dollars).toBeCloseTo(17.57, 2);
  });

  it("reports missing data instead of guessing when counts are incomplete", () => {
    const r = a.getActualVsTheoretical("last_14_days");
    expect(isNoData(r)).toBe(true);
    if (isNoData(r)) expect(r.needs).toMatch(/inventory counts/i);
  });

  it("reports missing data for a business with no counts at all", () => {
    expect(isNoData(createMockRestaurantData(SAMPLE_RESTAURANT_ID_2).getActualVsTheoretical("last_7_days"))).toBe(true);
  });
});

describe("get_sales_summary", () => {
  it("summarises totals, top and slow sellers and days", () => {
    const r = a.getSalesSummary("last_7_days");
    if (isNoData(r)) throw new Error("expected data");
    expect(r.total_sales).toBe(840);
    expect(r.total_units).toBe(105);
    expect(r.avg_daily_sales).toBe(120);
    expect(r.top_sellers[0]).toEqual({ item: "Burger", units: 70, revenue: 700 });
    expect(r.slow_sellers[0]).toEqual({ item: "Slider", units: 35, revenue: 140 });
    expect(r.daily_totals).toHaveLength(7);
    expect(r.daily_totals.every((d) => d.sales === 120)).toBe(true);
  });

  it("reports missing data when there are no sales in the period", () => {
    expect(isNoData(createMockRestaurantData("unknown-restaurant").getSalesSummary("last_7_days"))).toBe(true);
  });
});

describe("executeTool input handling", () => {
  it("runs a tool with valid input", async () => {
    const out = await executeTool(a, "get_sales_summary", { period: "last_7_days" });
    expect(out.ok).toBe(true);
  });
  it("rejects unknown tools, bad periods and non-object input", async () => {
    expect(await executeTool(a, "delete_everything", {})).toMatchObject({ ok: false });
    expect(await executeTool(a, "get_food_cost", { period: "last_year" })).toMatchObject({ ok: false });
    expect(await executeTool(a, "get_food_cost", {})).toMatchObject({ ok: false });
    expect(await executeTool(a, "get_food_cost", "last_7_days")).toMatchObject({ ok: false });
    expect(await executeTool(a, "get_food_cost", null)).toMatchObject({ ok: false });
  });
  it("defines exactly the five tools, none taking a restaurant identifier", () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name).sort()).toEqual([
      "get_actual_vs_theoretical", "get_food_cost", "get_menu_margins", "get_price_changes", "get_sales_summary",
    ]);
    for (const t of TOOL_DEFINITIONS) {
      expect(Object.keys(t.input_schema.properties).some((k) => /restaurant|business|tenant|user/i.test(k))).toBe(false);
    }
  });
});
