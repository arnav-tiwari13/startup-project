// Business profile: the questions we ask a new user, how answers are validated, and how they map to the
// restaurant_profiles columns (money in whole cents, percentages as numbers).

export const CONCEPTS = [
  { value: "full_service", label: "Full-service restaurant" },
  { value: "fast_casual", label: "Fast casual" },
  { value: "counter_service", label: "Counter service / QSR" },
  { value: "food_truck", label: "Food truck" },
  { value: "bar_pub", label: "Bar or pub" },
  { value: "cafe_bakery", label: "Cafe or bakery" },
  { value: "catering_ghost", label: "Catering or ghost kitchen" },
  { value: "other", label: "Other" },
] as const;

export const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "general_manager", label: "General manager" },
  { value: "chef", label: "Chef / kitchen manager" },
  { value: "finance", label: "Finance / bookkeeper" },
  { value: "other", label: "Other" },
] as const;

export const POS_SYSTEMS = ["Toast", "Square", "Clover", "Lightspeed", "SpotOn", "Revel", "Other", "None"] as const;

export const CHALLENGES = [
  { value: "food_cost", label: "Food cost too high" },
  { value: "waste", label: "Waste and spoilage" },
  { value: "vendor_prices", label: "Rising vendor prices" },
  { value: "portioning", label: "Portion control" },
  { value: "menu_pricing", label: "Menu pricing" },
  { value: "labor", label: "Labor cost" },
  { value: "inventory", label: "Inventory counts" },
  { value: "reporting", label: "No time for reporting" },
] as const;

export type Profile = {
  restaurant_id: string;
  business_name: string;
  concept: string;
  cuisine: string;
  city: string;
  state: string;
  owner_role: string;
  locations_count: number;
  opened_year: number | null;
  seats: number | null;
  days_open_per_week: number | null;
  staff_count: number | null;
  pos_system: string | null;
  main_vendors: string[];
  annual_revenue_cents: number;
  avg_check_cents: number | null;
  weekly_covers: number | null;
  monthly_food_purchases_cents: number | null;
  food_cost_pct: number | null;
  target_food_cost_pct: number | null;
  labor_cost_pct: number | null;
  challenges: string[];
};

// Everything the form holds is text, so empty and half-typed values stay representable.
export type ProfileForm = {
  businessName: string;
  concept: string;
  cuisine: string;
  city: string;
  state: string;
  ownerRole: string;
  locations: string;
  openedYear: string;
  seats: string;
  daysOpen: string;
  staff: string;
  pos: string;
  vendors: string;
  annualRevenue: string;
  avgCheck: string;
  weeklyCovers: string;
  monthlyFoodPurchases: string;
  foodCostPct: string;
  targetFoodCostPct: string;
  laborCostPct: string;
  challenges: string[];
};

export const emptyForm: ProfileForm = {
  businessName: "",
  concept: "",
  cuisine: "",
  city: "",
  state: "",
  ownerRole: "",
  locations: "1",
  openedYear: "",
  seats: "",
  daysOpen: "",
  staff: "",
  pos: "",
  vendors: "",
  annualRevenue: "",
  avgCheck: "",
  weeklyCovers: "",
  monthlyFoodPurchases: "",
  foodCostPct: "",
  targetFoodCostPct: "",
  laborCostPct: "",
  challenges: [],
};

export type Errors = Partial<Record<keyof ProfileForm, string>>;

// Steps group the fields; the stepped form validates one step at a time.
export const STEP_FIELDS: (keyof ProfileForm)[][] = [
  ["businessName", "concept", "cuisine", "city", "state", "ownerRole"],
  ["locations", "openedYear", "seats", "daysOpen", "staff", "pos", "vendors"],
  ["annualRevenue", "avgCheck", "weeklyCovers", "monthlyFoodPurchases", "foodCostPct", "targetFoodCostPct", "laborCostPct", "challenges"],
];

const blank = (s: string) => s.trim() === "";

const cleanNum = (s: string) => Number(s.trim().replace(/[$,%\s]/g, ""));

const check = {
  text(form: ProfileForm, key: keyof ProfileForm, label: string, max: number, errors: Errors) {
    const v = (form[key] as string).trim();
    if (!v) errors[key] = `${label} is required.`;
    else if (v.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
  },
  oneOf(form: ProfileForm, key: keyof ProfileForm, label: string, allowed: readonly string[], errors: Errors) {
    if (!allowed.includes(form[key] as string)) errors[key] = `Choose ${label}.`;
  },
  int(form: ProfileForm, key: keyof ProfileForm, label: string, min: number, max: number, required: boolean, errors: Errors) {
    const raw = form[key] as string;
    if (blank(raw)) {
      if (required) errors[key] = `${label} is required.`;
      return;
    }
    const n = cleanNum(raw);
    if (!Number.isInteger(n) || n < min || n > max) errors[key] = `${label} must be a whole number from ${min} to ${max}.`;
  },
  money(form: ProfileForm, key: keyof ProfileForm, label: string, required: boolean, errors: Errors) {
    const raw = form[key] as string;
    if (blank(raw)) {
      if (required) errors[key] = `${label} is required.`;
      return;
    }
    const n = cleanNum(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1e10) errors[key] = `${label} must be a dollar amount of 0 or more.`;
  },
  percent(form: ProfileForm, key: keyof ProfileForm, label: string, errors: Errors) {
    const raw = form[key] as string;
    if (blank(raw)) return;
    const n = cleanNum(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) errors[key] = `${label} must be between 0 and 100.`;
  },
};

export function validate(form: ProfileForm, fields: (keyof ProfileForm)[] = STEP_FIELDS.flat()): Errors {
  const all: Errors = {};
  check.text(form, "businessName", "Business name", 120, all);
  check.oneOf(form, "concept", "a restaurant type", CONCEPTS.map((c) => c.value), all);
  check.text(form, "cuisine", "Cuisine", 80, all);
  check.text(form, "city", "City", 80, all);
  check.text(form, "state", "State or region", 80, all);
  check.oneOf(form, "ownerRole", "your role", ROLES.map((r) => r.value), all);
  check.int(form, "locations", "Number of locations", 1, 1000, true, all);
  check.int(form, "openedYear", "Year opened", 1900, 2100, false, all);
  check.int(form, "seats", "Seats", 0, 10000, false, all);
  check.int(form, "daysOpen", "Days open per week", 1, 7, false, all);
  check.int(form, "staff", "Staff count", 0, 100000, false, all);
  if (form.pos.trim().length > 80) all.pos = "POS system must be 80 characters or fewer.";
  if (splitList(form.vendors).length > 20) all.vendors = "List up to 20 vendors.";
  check.money(form, "annualRevenue", "Annual revenue", true, all);
  check.money(form, "avgCheck", "Average check", false, all);
  check.int(form, "weeklyCovers", "Weekly covers", 0, 10000000, false, all);
  check.money(form, "monthlyFoodPurchases", "Monthly food purchases", false, all);
  check.percent(form, "foodCostPct", "Food cost %", all);
  check.percent(form, "targetFoodCostPct", "Target food cost %", all);
  check.percent(form, "laborCostPct", "Labor cost %", all);

  const picked: Errors = {};
  for (const f of fields) if (all[f]) picked[f] = all[f];
  return picked;
}

export const splitList = (s: string) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const cents = (s: string) => (blank(s) ? null : Math.round(cleanNum(s) * 100));
const int = (s: string) => (blank(s) ? null : cleanNum(s));
const pctOrNull = (s: string) => (blank(s) ? null : cleanNum(s));

// The JSON object save_restaurant_profile() expects. Call only after validate() returns no errors.
export function toPayload(form: ProfileForm) {
  return {
    business_name: form.businessName.trim(),
    concept: form.concept,
    cuisine: form.cuisine.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    owner_role: form.ownerRole,
    locations_count: int(form.locations) ?? 1,
    opened_year: int(form.openedYear),
    seats: int(form.seats),
    days_open_per_week: int(form.daysOpen),
    staff_count: int(form.staff),
    pos_system: form.pos.trim() || null,
    main_vendors: splitList(form.vendors),
    annual_revenue_cents: cents(form.annualRevenue),
    avg_check_cents: cents(form.avgCheck),
    weekly_covers: int(form.weeklyCovers),
    monthly_food_purchases_cents: cents(form.monthlyFoodPurchases),
    food_cost_pct: pctOrNull(form.foodCostPct),
    target_food_cost_pct: pctOrNull(form.targetFoodCostPct),
    labor_cost_pct: pctOrNull(form.laborCostPct),
    challenges: form.challenges,
  };
}

const str = (n: number | null) => (n === null ? "" : String(n));
const dollars = (c: number | null) => (c === null ? "" : String(c / 100));

export function fromProfile(p: Profile): ProfileForm {
  return {
    businessName: p.business_name,
    concept: p.concept,
    cuisine: p.cuisine,
    city: p.city,
    state: p.state,
    ownerRole: p.owner_role,
    locations: String(p.locations_count),
    openedYear: str(p.opened_year),
    seats: str(p.seats),
    daysOpen: str(p.days_open_per_week),
    staff: str(p.staff_count),
    pos: p.pos_system ?? "",
    vendors: p.main_vendors.join(", "),
    annualRevenue: dollars(p.annual_revenue_cents),
    avgCheck: dollars(p.avg_check_cents),
    weeklyCovers: str(p.weekly_covers),
    monthlyFoodPurchases: dollars(p.monthly_food_purchases_cents),
    foodCostPct: str(p.food_cost_pct),
    targetFoodCostPct: str(p.target_food_cost_pct),
    laborCostPct: str(p.labor_cost_pct),
    challenges: p.challenges,
  };
}
