// Sample businesses for the dashboard seed. Cedar Lane keeps weekly inventory counts; Rolling Tacos (a food
// truck) does not, so its "actual vs theoretical" table shows the missing-data state.
// The ids match supabase/sample-restaurants.sql and the advisor's mock data.
export type Category = "meat" | "produce" | "dairy" | "dry_goods" | "beverage" | "other";

export interface IngredientSpec {
  key: string;
  name: string;
  unit: string;
  category: Category;
  vendor: string;
  /** Cents per unit at the start of the data. */
  unitCostCents: number;
  /** Price moves: `daysAgo` before the as-of date the price changes by `pct` percent (negative = drop). */
  changes?: { daysAgo: number; pct: number }[];
  /** Actual usage / recipe usage. 1.12 means 12% more used than sales explain (over-portioning, waste). */
  usageFactor?: number;
}

export interface MenuSpec {
  key: string;
  name: string;
  priceCents: number;
  weeklyUnits: number;
  recipe: [ingredientKey: string, qty: number][];
}

export interface RestaurantSpec {
  id: string;
  name: string;
  /** Delivery weekdays per vendor, 0 = Sunday. */
  vendors: { name: string; deliveryDays: number[] }[];
  ingredients: IngredientSpec[];
  menu: MenuSpec[];
  laborPct: number;
  countInventory: boolean;
}

const mac: [string, number][] = [["pasta", 0.25], ["cheddar", 0.25]];

export const CEDAR_LANE: RestaurantSpec = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Cedar Lane Smokehouse (sample)",
  laborPct: 0.3,
  countInventory: true,
  vendors: [
    { name: "Sysco", deliveryDays: [1, 4] },
    { name: "US Foods", deliveryDays: [2] },
    { name: "Local produce", deliveryDays: [1, 5] },
    { name: "Local bakery", deliveryDays: [3, 6] },
  ],
  ingredients: [
    { key: "brisket", name: "Brisket, whole packer", unit: "lb", category: "meat", vendor: "Sysco", unitCostCents: 549, usageFactor: 1.12, changes: [{ daysAgo: 5, pct: 12 }] },
    { key: "pork_butt", name: "Pork butt", unit: "lb", category: "meat", vendor: "Sysco", unitCostCents: 210, usageFactor: 1.04 },
    { key: "ribs", name: "Pork spare ribs", unit: "rack", category: "meat", vendor: "US Foods", unitCostCents: 1420, usageFactor: 1.15, changes: [{ daysAgo: 12, pct: 9 }] },
    { key: "sausage", name: "Smoked sausage", unit: "lb", category: "meat", vendor: "US Foods", unitCostCents: 340, usageFactor: 1.02 },
    { key: "cheddar", name: "Cheddar, shredded", unit: "lb", category: "dairy", vendor: "US Foods", unitCostCents: 310, usageFactor: 1.03, changes: [{ daysAgo: 3, pct: 6 }] },
    { key: "pasta", name: "Elbow pasta", unit: "lb", category: "dry_goods", vendor: "US Foods", unitCostCents: 120, changes: [{ daysAgo: 15, pct: -6 }] },
    { key: "pinto", name: "Pinto beans", unit: "lb", category: "dry_goods", vendor: "US Foods", unitCostCents: 95 },
    { key: "pudding", name: "Banana pudding base", unit: "each", category: "dry_goods", vendor: "US Foods", unitCostCents: 55 },
    { key: "slaw", name: "Coleslaw mix", unit: "lb", category: "produce", vendor: "Local produce", unitCostCents: 110, usageFactor: 1.05, changes: [{ daysAgo: 18, pct: 25 }] },
    { key: "pickles", name: "Pickles and onions", unit: "lb", category: "produce", vendor: "Local produce", unitCostCents: 160 },
    { key: "tortillas", name: "Corn tortillas", unit: "each", category: "dry_goods", vendor: "Local produce", unitCostCents: 15 },
    { key: "buns", name: "Buns", unit: "each", category: "dry_goods", vendor: "Local bakery", unitCostCents: 45, usageFactor: 0.98 },
    { key: "tea", name: "Sweet tea concentrate", unit: "oz", category: "beverage", vendor: "US Foods", unitCostCents: 9 },
    { key: "packaging", name: "Tray, paper and utensils", unit: "set", category: "other", vendor: "US Foods", unitCostCents: 88, usageFactor: 1.02 },
  ],
  menu: [
    // Generous portion: high sales but a thin margin (the "low margin, high sales" flag).
    { key: "brisket-plate", name: "Brisket plate", priceCents: 2200, weeklyUnits: 310, recipe: [["brisket", 1.3], ...mac, ["slaw", 0.2], ["packaging", 1]] },
    { key: "brisket-sandwich", name: "Brisket sandwich", priceCents: 1500, weeklyUnits: 220, recipe: [["brisket", 0.6], ["buns", 1], ["pickles", 0.05], ["packaging", 1]] },
    { key: "ribs-half", name: "Ribs, half rack", priceCents: 2600, weeklyUnits: 180, recipe: [["ribs", 0.5], ["slaw", 0.2], ["packaging", 1]] },
    { key: "brisket-tacos", name: "Chopped brisket tacos", priceCents: 1400, weeklyUnits: 150, recipe: [["brisket", 0.35], ["tortillas", 3], ["packaging", 1]] },
    { key: "mac-cheese", name: "Mac and cheese (side)", priceCents: 500, weeklyUnits: 400, recipe: [...mac] },
    { key: "pulled-pork", name: "Pulled pork plate", priceCents: 1800, weeklyUnits: 190, recipe: [["pork_butt", 1.2], ...mac, ["slaw", 0.2], ["packaging", 1]] },
    // Priced too low and rarely ordered: low margin, low sales.
    { key: "sausage-plate", name: "Smoked sausage plate", priceCents: 1100, weeklyUnits: 55, recipe: [["sausage", 0.9], ...mac, ["slaw", 0.2], ["packaging", 1]] },
    // Great margin, hardly anyone orders it: the "high margin, low sales" flag.
    { key: "burnt-ends", name: "Burnt ends", priceCents: 1900, weeklyUnits: 38, recipe: [["brisket", 0.4], ["pinto", 0.15], ["packaging", 1]] },
    { key: "baked-beans", name: "Baked beans (side)", priceCents: 400, weeklyUnits: 230, recipe: [["pinto", 0.3]] },
    { key: "banana-pudding", name: "Banana pudding", priceCents: 600, weeklyUnits: 260, recipe: [["pudding", 1]] },
    { key: "sweet-tea", name: "Sweet tea", priceCents: 350, weeklyUnits: 420, recipe: [["tea", 8]] },
  ],
};

export const ROLLING_TACOS: RestaurantSpec = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Rolling Tacos (sample)",
  laborPct: 0.26,
  countInventory: false,
  vendors: [
    { name: "Local butcher", deliveryDays: [1, 4] },
    { name: "Tortilleria", deliveryDays: [2, 5] },
    { name: "Restaurant Depot", deliveryDays: [3] },
  ],
  ingredients: [
    { key: "chicken", name: "Chicken thigh", unit: "lb", category: "meat", vendor: "Local butcher", unitCostCents: 320, changes: [{ daysAgo: 8, pct: 11 }] },
    { key: "pastor", name: "Al pastor pork", unit: "lb", category: "meat", vendor: "Local butcher", unitCostCents: 310 },
    { key: "tortillas", name: "Corn tortillas", unit: "each", category: "dry_goods", vendor: "Tortilleria", unitCostCents: 12 },
    { key: "cheese", name: "Oaxaca cheese", unit: "lb", category: "dairy", vendor: "Restaurant Depot", unitCostCents: 500, changes: [{ daysAgo: 20, pct: 7 }] },
    { key: "salsa", name: "Salsa verde", unit: "lb", category: "produce", vendor: "Restaurant Depot", unitCostCents: 140 },
    { key: "avocado", name: "Avocado", unit: "lb", category: "produce", vendor: "Restaurant Depot", unitCostCents: 275, changes: [{ daysAgo: 9, pct: 35 }] },
    { key: "horchata", name: "Horchata mix", unit: "oz", category: "beverage", vendor: "Restaurant Depot", unitCostCents: 7 },
    { key: "packaging", name: "Foil and boat", unit: "each", category: "other", vendor: "Restaurant Depot", unitCostCents: 35 },
  ],
  menu: [
    { key: "chicken-taco", name: "Chicken taco", priceCents: 450, weeklyUnits: 700, recipe: [["chicken", 0.25], ["tortillas", 2], ["salsa", 0.05], ["packaging", 1]] },
    { key: "pastor-taco", name: "Al pastor taco", priceCents: 450, weeklyUnits: 650, recipe: [["pastor", 0.25], ["tortillas", 2], ["salsa", 0.05], ["packaging", 1]] },
    { key: "quesadilla", name: "Chicken quesadilla", priceCents: 900, weeklyUnits: 220, recipe: [["chicken", 0.3], ["cheese", 0.3], ["tortillas", 2], ["packaging", 1]] },
    // Avocado price spike squeezes this one: busy item, thin margin.
    { key: "guac", name: "Guacamole cup", priceCents: 300, weeklyUnits: 340, recipe: [["avocado", 0.5], ["packaging", 1]] },
    { key: "horchata", name: "Horchata", priceCents: 400, weeklyUnits: 180, recipe: [["horchata", 10]] },
  ],
};

export const SAMPLE_SPECS = [CEDAR_LANE, ROLLING_TACOS];
