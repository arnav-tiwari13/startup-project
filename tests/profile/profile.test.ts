import { describe, expect, it } from "vitest";
import { emptyForm, fromProfile, STEP_FIELDS, toPayload, validate, type ProfileForm } from "../../src/profile";

const valid: ProfileForm = {
  ...emptyForm,
  businessName: "  Cedar Lane Smokehouse ",
  concept: "counter_service",
  cuisine: "BBQ",
  city: "Austin",
  state: "TX",
  ownerRole: "owner",
  annualRevenue: "$1,200,000",
};

describe("validate", () => {
  it("accepts a form with only the required fields", () => {
    expect(validate(valid)).toEqual({});
  });

  it("requires the core business and revenue fields", () => {
    const errors = validate(emptyForm);
    expect(Object.keys(errors).sort()).toEqual(["annualRevenue", "businessName", "city", "concept", "cuisine", "ownerRole", "state"]);
  });

  it("validates only the requested step's fields", () => {
    const errors = validate(emptyForm, STEP_FIELDS[0]);
    expect(errors.annualRevenue).toBeUndefined();
    expect(errors.businessName).toBeDefined();
  });

  it("rejects out-of-range and non-numeric values", () => {
    const errors = validate({ ...valid, daysOpen: "8", foodCostPct: "140", seats: "1.5", annualRevenue: "lots", locations: "0", openedYear: "1800" });
    expect(Object.keys(errors).sort()).toEqual(["annualRevenue", "daysOpen", "foodCostPct", "locations", "openedYear", "seats"]);
  });

  it("rejects an unknown restaurant type or role", () => {
    const errors = validate({ ...valid, concept: "spaceship", ownerRole: "wizard" });
    expect(errors.concept).toBeDefined();
    expect(errors.ownerRole).toBeDefined();
  });
});

describe("toPayload", () => {
  it("converts dollars to whole cents and trims text", () => {
    const p = toPayload({ ...valid, avgCheck: "18.45", monthlyFoodPurchases: "31,000" });
    expect(p.business_name).toBe("Cedar Lane Smokehouse");
    expect(p.annual_revenue_cents).toBe(120_000_000);
    expect(p.avg_check_cents).toBe(1845);
    expect(p.monthly_food_purchases_cents).toBe(3_100_000);
  });

  it("sends null for blank optional fields and splits vendors", () => {
    const p = toPayload({ ...valid, vendors: "Sysco, US Foods , ,Local produce", foodCostPct: "35.8", challenges: ["waste"] });
    expect(p.seats).toBeNull();
    expect(p.pos_system).toBeNull();
    expect(p.main_vendors).toEqual(["Sysco", "US Foods", "Local produce"]);
    expect(p.food_cost_pct).toBe(35.8);
    expect(p.challenges).toEqual(["waste"]);
  });

  it("round-trips through fromProfile", () => {
    const form = { ...valid, avgCheck: "18.45", seats: "40", vendors: "Sysco, US Foods", laborCostPct: "28.5" };
    const payload = toPayload(form);
    const back = fromProfile({ restaurant_id: "r", ...payload, annual_revenue_cents: payload.annual_revenue_cents! });
    expect(toPayload(back)).toEqual(payload);
  });
});
