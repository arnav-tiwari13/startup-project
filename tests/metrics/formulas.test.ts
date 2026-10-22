import { describe, expect, it } from "vitest";
import {
  actualUsageQty, averageDailySalesCents, theoreticalFoodCostCents, categorySpendPct, classifyMenuItem, estimatedProfitCents, foodCostPct, laborPct, marginCents, marginPct,
  missing, monthlyPriceImpactCents, monthlyUsageQty, ok, pctChange, plateCostCents, pointChange, popularityThreshold,
  primeCostPct, priceChangePct, profitContributionCents, rateAgainstTarget, theoreticalUsageQty, varianceCents,
  variancePct, varianceQty, vsTarget,
} from "../../supabase/functions/_shared/metrics/index.ts";

const val = (m: { ok: boolean; value?: number }) => (m.ok ? m.value : undefined);
const why = (m: { ok: boolean; reason?: string }) => (m.ok ? undefined : m.reason);

describe("profit snapshot", () => {
  it("food, labor and prime cost percentages", () => {
    expect(val(foodCostPct(30_000, 100_000))).toBeCloseTo(30);
    expect(val(laborPct(28_000, 100_000))).toBeCloseTo(28);
    expect(val(primeCostPct(30_000, 28_000, 100_000))).toBeCloseTo(58);
  });
  it("zero or negative sales is missing, never infinity or 0%", () => {
    expect(why(foodCostPct(5_000, 0))).toBe("no_sales");
    expect(why(laborPct(5_000, 0))).toBe("no_sales");
    expect(why(primeCostPct(5_000, 5_000, 0))).toBe("no_sales");
    expect(why(foodCostPct(5_000, -1))).toBe("no_sales");
  });
  it("rejects NaN and Infinity", () => {
    expect(why(foodCostPct(Number.NaN, 100))).toBe("invalid_input");
    expect(why(foodCostPct(100, Number.POSITIVE_INFINITY))).toBe("invalid_input");
  });
  it("estimated profit subtracts food and labor, and can be negative", () => {
    expect(val(estimatedProfitCents(100_000, 30_000, 28_000))).toBe(42_000);
    expect(val(estimatedProfitCents(10_000, 6_000, 6_000))).toBe(-2_000);
    expect(why(estimatedProfitCents(Number.NaN, 1, 1))).toBe("invalid_input");
  });
});

describe("comparisons and targets", () => {
  it("percent change", () => {
    expect(val(pctChange(110, 100))).toBeCloseTo(10);
    expect(val(pctChange(90, 100))).toBeCloseTo(-10);
    expect(val(pctChange(0, 100))).toBeCloseTo(-100);
  });
  it("percent change from zero is missing", () => {
    expect(why(pctChange(50, 0))).toBe("no_previous_period");
    expect(why(pctChange(Number.NaN, 5))).toBe("invalid_input");
  });
  it("point change between two percent metrics", () => {
    expect(val(pointChange(ok(30), ok(32)))).toBeCloseTo(-2);
    expect(why(pointChange(ok(30), missing("no_sales")))).toBe("no_previous_period");
    expect(why(pointChange(missing("no_sales"), ok(30)))).toBe("no_sales");
  });
  it("vs target", () => {
    expect(val(vsTarget(ok(33), 30))).toBeCloseTo(3);
    expect(why(vsTarget(ok(33), null))).toBe("no_target");
    expect(why(vsTarget(ok(33), undefined))).toBe("no_target");
    expect(why(vsTarget(missing("no_sales"), 30))).toBe("no_sales");
  });
  it("rates lower-is-better metrics green / yellow / red", () => {
    expect(rateAgainstTarget(ok(29), 30, "lower_is_better")).toBe("good");
    expect(rateAgainstTarget(ok(30), 30, "lower_is_better")).toBe("good");
    expect(rateAgainstTarget(ok(32), 30, "lower_is_better")).toBe("watch");
    expect(rateAgainstTarget(ok(34), 30, "lower_is_better")).toBe("bad");
  });
  it("rates higher-is-better metrics green / yellow / red", () => {
    expect(rateAgainstTarget(ok(72), 70, "higher_is_better")).toBe("good");
    expect(rateAgainstTarget(ok(65), 70, "higher_is_better")).toBe("watch");
    expect(rateAgainstTarget(ok(50), 70, "higher_is_better")).toBe("bad");
  });
  it("is unknown, not green, when value or target is missing", () => {
    expect(rateAgainstTarget(missing("no_sales"), 30, "lower_is_better")).toBe("unknown");
    expect(rateAgainstTarget(ok(30), null, "lower_is_better")).toBe("unknown");
  });
});

describe("food cost by category", () => {
  it("category spend as a share of sales", () => {
    expect(val(categorySpendPct(12_000, 100_000))).toBeCloseTo(12);
    expect(why(categorySpendPct(12_000, 0))).toBe("no_sales");
  });
});

describe("ingredient price changes", () => {
  it("percent change in unit price", () => {
    expect(val(priceChangePct(200, 250))).toBeCloseTo(25);
    expect(why(priceChangePct(0, 250))).toBe("no_previous_period");
  });
  it("monthly usage scales a window to 30 days", () => {
    expect(val(monthlyUsageQty(70, 14))).toBeCloseTo(150);
    expect(why(monthlyUsageQty(70, 0))).toBe("invalid_input");
    expect(why(monthlyUsageQty(-1, 14))).toBe("invalid_input");
  });
  it("monthly impact is the price difference times monthly usage, in whole cents", () => {
    expect(val(monthlyPriceImpactCents(200, 250, ok(150)))).toBe(7_500);
    expect(val(monthlyPriceImpactCents(250, 200, ok(150)))).toBe(-7_500);
    expect(val(monthlyPriceImpactCents(3.5, 4.1, ok(1_000)))).toBe(600);
    expect(why(monthlyPriceImpactCents(200, 250, missing("invalid_input")))).toBe("invalid_input");
  });
});

describe("menu margins", () => {
  it("plate cost sums quantity x unit cost, rounded to cents", () => {
    expect(val(plateCostCents([{ qty: 8, unitCostCents: 45 }, { qty: 1, unitCostCents: 60 }]))).toBe(420);
    expect(val(plateCostCents([{ qty: 3, unitCostCents: 3.3 }]))).toBe(10);
  });
  it("missing recipe or any missing price is missing, not a partial sum", () => {
    expect(why(plateCostCents([]))).toBe("no_recipe");
    expect(why(plateCostCents([{ qty: 8, unitCostCents: 45 }, { qty: 1, unitCostCents: undefined }]))).toBe("missing_price");
    expect(why(plateCostCents([{ qty: -1, unitCostCents: 45 }]))).toBe("invalid_input");
  });
  it("margin $ and margin %", () => {
    const margin = marginCents(1_400, ok(420));
    expect(val(margin)).toBe(980);
    expect(val(marginPct(1_400, margin))).toBeCloseTo(70);
  });
  it("carries a missing plate cost through, and rejects a zero price", () => {
    expect(why(marginCents(1_400, missing("no_recipe")))).toBe("no_recipe");
    expect(why(marginCents(0, ok(420)))).toBe("no_price");
    expect(why(marginPct(0, ok(100)))).toBe("no_price");
  });
  it("profit contribution is margin x units", () => {
    expect(val(profitContributionCents(ok(980), 50))).toBe(49_000);
    expect(val(profitContributionCents(ok(980), 0))).toBe(0);
    expect(why(profitContributionCents(missing("no_recipe"), 50))).toBe("no_recipe");
    expect(why(profitContributionCents(ok(980), -2))).toBe("invalid_input");
  });
  it("classifies low-margin/high-sales and high-margin/low-sales items", () => {
    const min = popularityThreshold(1_000, 10); // 70
    expect(min).toBeCloseTo(70);
    expect(classifyMenuItem(ok(75), 200, 65, min)).toBe("star");
    expect(classifyMenuItem(ok(50), 200, 65, min)).toBe("plowhorse");
    expect(classifyMenuItem(ok(75), 20, 65, min)).toBe("puzzle");
    expect(classifyMenuItem(ok(50), 20, 65, min)).toBe("dog");
  });
  it("does not classify when margin or target is missing", () => {
    expect(classifyMenuItem(missing("no_recipe"), 200, 65, 70)).toBe("unknown");
    expect(classifyMenuItem(ok(75), 200, null, 70)).toBe("unknown");
  });
  it("popularity threshold is 0 with no sales or no items", () => {
    expect(popularityThreshold(0, 10)).toBe(0);
    expect(popularityThreshold(100, 0)).toBe(0);
  });
});

describe("actual vs theoretical usage", () => {
  it("theoretical usage sums units sold x recipe quantity", () => {
    expect(val(theoreticalUsageQty([{ unitsSold: 10, qtyPerUnit: 8 }, { unitsSold: 5, qtyPerUnit: 4 }]))).toBe(100);
    expect(val(theoreticalUsageQty([]))).toBe(0);
  });
  it("a sold item with no recipe makes theoretical usage missing", () => {
    expect(why(theoreticalUsageQty([{ unitsSold: 10, qtyPerUnit: 8 }, { unitsSold: 3, qtyPerUnit: undefined }]))).toBe("no_recipe");
  });
  it("actual usage is beginning + purchases - ending", () => {
    expect(val(actualUsageQty(50, 100, 30))).toBe(120);
    expect(val(actualUsageQty(0, 0, 0))).toBe(0);
  });
  it("a missing inventory count is missing, even when the other count exists", () => {
    expect(why(actualUsageQty(null, 100, 30))).toBe("missing_inventory_count");
    expect(why(actualUsageQty(50, 100, undefined))).toBe("missing_inventory_count");
  });
  it("a negative result (ending count above stock on hand) is treated as a bad count", () => {
    expect(why(actualUsageQty(10, 0, 40))).toBe("invalid_input");
  });
  it("variance in units, dollars and percent", () => {
    const v = varianceQty(ok(120), ok(100));
    expect(val(v)).toBe(20);
    expect(val(varianceCents(v, 45))).toBe(900);
    expect(val(variancePct(v, ok(100)))).toBeCloseTo(20);
  });
  it("variance can be negative (used less than recipes say)", () => {
    expect(val(varianceQty(ok(80), ok(100)))).toBe(-20);
  });
  it("variance carries missing inputs through and avoids dividing by zero", () => {
    expect(why(varianceQty(missing("missing_inventory_count"), ok(100)))).toBe("missing_inventory_count");
    expect(why(varianceQty(ok(120), missing("no_recipe")))).toBe("no_recipe");
    expect(why(varianceCents(ok(20), undefined))).toBe("missing_price");
    expect(why(variancePct(ok(20), ok(0)))).toBe("no_theoretical_usage");
  });
});

describe("theoretical food cost and average daily sales", () => {
  it("sums plate cost x units, skips unsold items, and is missing when a sold item has no plate cost", () => {
    expect(val(theoreticalFoodCostCents([{ plateCost: ok(350), unitsSold: 10 }, { plateCost: ok(170), unitsSold: 5 }]))).toBe(4350);
    expect(val(theoreticalFoodCostCents([{ plateCost: ok(350), unitsSold: 10 }, { plateCost: missing("no_recipe"), unitsSold: 0 }]))).toBe(3500);
    expect(why(theoreticalFoodCostCents([{ plateCost: missing("missing_price"), unitsSold: 3 }]))).toBe("missing_price");
    expect(why(theoreticalFoodCostCents([{ plateCost: ok(100), unitsSold: -1 }]))).toBe("invalid_input");
  });
  it("average daily sales needs a positive number of days", () => {
    expect(val(averageDailySalesCents(84_000, 7))).toBe(12_000);
    expect(why(averageDailySalesCents(84_000, 0))).toBe("invalid_input");
  });
});
