// Sample data for two fictional food businesses, generated deterministically (no randomness, no clock).
// Replace createRestaurantData() in data-source.ts with a real loader when real tables exist.
import { addDays } from "./dataset-data.ts";
import type { DailySale, Ingredient, MenuItem, PricePoint, RestaurantDataset, UsageCount } from "./types.ts";

export const SAMPLE_RESTAURANT_ID = "00000000-0000-4000-8000-000000000001";
export const SAMPLE_RESTAURANT_ID_2 = "00000000-0000-4000-8000-000000000002";
export const MOCK_AS_OF = "2026-10-19";

const WEEKDAY_WEIGHT = [1.2, 0.8, 0.8, 0.9, 1.0, 1.3, 1.5]; // Sun..Sat
const WEIGHT_SUM = WEEKDAY_WEIGHT.reduce((a, b) => a + b, 0);

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Daily units from weekly volume: weekday shape plus a small repeating wobble so days differ. */
function dailyUnits(weekly: number, date: string, dayIndex: number) {
  const wobble = 1 + (((dayIndex * 7) % 5) - 2) * 0.02;
  return Math.max(0, Math.round((weekly * WEEKDAY_WEIGHT[weekday(date)] * wobble) / WEIGHT_SUM));
}

function buildSales(asOf: string, days: number, weekly: Record<string, number>): DailySale[] {
  const out: DailySale[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(asOf, -(days - 1) + i);
    for (const [itemId, w] of Object.entries(weekly)) out.push({ date, itemId, units: dailyUnits(w, date, i) });
  }
  return out;
}

/** Weekly inventory counts, each week ending on asOf minus a multiple of 7. Actual = recipe usage x factor. */
function buildUsage(ds: Omit<RestaurantDataset, "usage">, weeks: number, factor: Record<string, number>): UsageCount[] {
  const out: UsageCount[] = [];
  const itemById = new Map(ds.menu.map((m) => [m.id, m]));
  for (let w = 0; w < weeks; w++) {
    const end = addDays(ds.asOf, -7 * w);
    const start = addDays(end, -6);
    const qty = new Map<string, number>();
    for (const s of ds.sales) {
      if (s.date < start || s.date > end) continue;
      for (const line of itemById.get(s.itemId)!.recipe) qty.set(line.ingredientId, (qty.get(line.ingredientId) ?? 0) + line.qty * s.units);
    }
    for (const [ingredientId, q] of qty) {
      out.push({ ingredientId, start, end, actualUsed: Math.round(q * (factor[ingredientId] ?? 1) * 100) / 100 });
    }
  }
  return out;
}

function cedarLane(): RestaurantDataset {
  const asOf = MOCK_AS_OF;
  const ingredients: Ingredient[] = [
    { id: "brisket", name: "Brisket, whole packer", unit: "lb", vendor: "Sysco" },
    { id: "pork_butt", name: "Pork butt", unit: "lb", vendor: "Sysco" },
    { id: "ribs", name: "Pork spare ribs", unit: "rack", vendor: "US Foods" },
    { id: "sausage", name: "Smoked sausage", unit: "lb", vendor: "US Foods" },
    { id: "cheddar", name: "Cheddar, shredded", unit: "lb", vendor: "US Foods" },
    { id: "pasta", name: "Elbow pasta", unit: "lb", vendor: "US Foods" },
    { id: "slaw", name: "Coleslaw mix", unit: "lb", vendor: "Local produce" },
    { id: "buns", name: "Buns", unit: "each", vendor: "Local bakery" },
    { id: "tortillas", name: "Corn tortillas", unit: "each", vendor: "Local produce" },
    { id: "pudding", name: "Banana pudding base", unit: "each", vendor: "US Foods" },
    { id: "packaging", name: "Tray, paper and utensils", unit: "set", vendor: "US Foods" },
  ];
  const prices: PricePoint[] = [
    { ingredientId: "brisket", date: "2026-08-01", unitCost: 5.49 },
    { ingredientId: "brisket", date: addDays(asOf, -5), unitCost: 5.98 },
    { ingredientId: "pork_butt", date: "2026-08-01", unitCost: 2.1 },
    { ingredientId: "ribs", date: "2026-08-01", unitCost: 14.2 },
    { ingredientId: "sausage", date: "2026-08-01", unitCost: 3.4 },
    { ingredientId: "cheddar", date: "2026-08-01", unitCost: 3.1 },
    { ingredientId: "cheddar", date: addDays(asOf, -3), unitCost: 3.29 },
    { ingredientId: "pasta", date: "2026-08-01", unitCost: 1.2 },
    { ingredientId: "slaw", date: "2026-08-01", unitCost: 1.1 },
    { ingredientId: "buns", date: "2026-08-01", unitCost: 0.45 },
    { ingredientId: "tortillas", date: "2026-08-01", unitCost: 0.15 },
    { ingredientId: "pudding", date: "2026-08-01", unitCost: 0.55 },
    { ingredientId: "packaging", date: "2026-08-01", unitCost: 0.88 },
  ];
  const mac = [{ ingredientId: "pasta", qty: 0.25 }, { ingredientId: "cheddar", qty: 0.25 }];
  const menu: MenuItem[] = [
    { id: "brisket-plate", name: "Brisket plate", price: 24, recipe: [{ ingredientId: "brisket", qty: 1.05 }, ...mac, { ingredientId: "slaw", qty: 0.2 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "brisket-sandwich", name: "Brisket sandwich", price: 15, recipe: [{ ingredientId: "brisket", qty: 0.6 }, { ingredientId: "buns", qty: 1 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "ribs-half", name: "Ribs, half rack", price: 26, recipe: [{ ingredientId: "ribs", qty: 0.5 }, { ingredientId: "slaw", qty: 0.2 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "brisket-tacos", name: "Chopped brisket tacos", price: 14, recipe: [{ ingredientId: "brisket", qty: 0.35 }, { ingredientId: "tortillas", qty: 3 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "mac-cheese", name: "Mac and cheese (side)", price: 5, recipe: [...mac] },
    { id: "pulled-pork", name: "Pulled pork plate", price: 18, recipe: [{ ingredientId: "pork_butt", qty: 1.2 }, ...mac, { ingredientId: "slaw", qty: 0.2 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "sausage-plate", name: "Sausage plate", price: 17, recipe: [{ ingredientId: "sausage", qty: 0.7 }, ...mac, { ingredientId: "slaw", qty: 0.2 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "banana-pudding", name: "Banana pudding", price: 6, recipe: [{ ingredientId: "pudding", qty: 1 }] },
  ];
  const sales = buildSales(asOf, 35, {
    "brisket-plate": 310, "brisket-sandwich": 220, "ribs-half": 180, "brisket-tacos": 150,
    "mac-cheese": 400, "pulled-pork": 190, "sausage-plate": 140, "banana-pudding": 260,
  });
  const base = { restaurantId: SAMPLE_RESTAURANT_ID, name: "Cedar Lane Smokehouse", asOf, ingredients, prices, menu, sales };
  // Brisket over-portioned, ribs wasted: the story the advisor should be able to find.
  const usage = buildUsage(base, 5, { brisket: 1.12, ribs: 1.15, pork_butt: 1.04, cheddar: 1.03, slaw: 1.05, sausage: 1.02, packaging: 1.02 });
  return { ...base, usage };
}

/** A food truck that has not set up inventory counts yet: used to exercise "data missing" answers. */
function rollingTacos(): RestaurantDataset {
  const asOf = MOCK_AS_OF;
  const ingredients: Ingredient[] = [
    { id: "chicken", name: "Chicken thigh", unit: "lb", vendor: "Local butcher" },
    { id: "pastor", name: "Al pastor pork", unit: "lb", vendor: "Local butcher" },
    { id: "tortillas", name: "Corn tortillas", unit: "each", vendor: "Tortilleria" },
    { id: "cheese", name: "Oaxaca cheese", unit: "lb", vendor: "Restaurant Depot" },
    { id: "salsa", name: "Salsa verde", unit: "lb", vendor: "Restaurant Depot" },
    { id: "packaging", name: "Foil and boat", unit: "each", vendor: "Restaurant Depot" },
  ];
  const prices: PricePoint[] = [
    { ingredientId: "chicken", date: "2026-08-01", unitCost: 3.2 },
    { ingredientId: "chicken", date: addDays(asOf, -8), unitCost: 3.55 },
    { ingredientId: "pastor", date: "2026-08-01", unitCost: 3.1 },
    { ingredientId: "tortillas", date: "2026-08-01", unitCost: 0.12 },
    { ingredientId: "cheese", date: "2026-08-01", unitCost: 5.0 },
    { ingredientId: "salsa", date: "2026-08-01", unitCost: 1.4 },
    { ingredientId: "packaging", date: "2026-08-01", unitCost: 0.35 },
  ];
  const menu: MenuItem[] = [
    { id: "chicken-taco", name: "Chicken taco", price: 4.5, recipe: [{ ingredientId: "chicken", qty: 0.25 }, { ingredientId: "tortillas", qty: 2 }, { ingredientId: "salsa", qty: 0.05 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "pastor-taco", name: "Al pastor taco", price: 4.5, recipe: [{ ingredientId: "pastor", qty: 0.25 }, { ingredientId: "tortillas", qty: 2 }, { ingredientId: "salsa", qty: 0.05 }, { ingredientId: "packaging", qty: 1 }] },
    { id: "quesadilla", name: "Chicken quesadilla", price: 9, recipe: [{ ingredientId: "chicken", qty: 0.3 }, { ingredientId: "cheese", qty: 0.3 }, { ingredientId: "tortillas", qty: 2 }, { ingredientId: "packaging", qty: 1 }] },
  ];
  const sales = buildSales(asOf, 35, { "chicken-taco": 700, "pastor-taco": 650, quesadilla: 220 });
  return { restaurantId: SAMPLE_RESTAURANT_ID_2, name: "Rolling Tacos", asOf, ingredients, prices, menu, sales, usage: [] };
}

export const MOCK_DATASETS: Record<string, RestaurantDataset> = {
  [SAMPLE_RESTAURANT_ID]: cedarLane(),
  [SAMPLE_RESTAURANT_ID_2]: rollingTacos(),
};
