// The rows the tables are computed from. `Bundle` is plain data, so the compute code is testable without a database.
// `loadBundle` fills it through a Supabase client that runs as the signed-in user, so row-level security applies,
// and it also filters by restaurant id explicitly as a second layer.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateRange } from "../metrics/index.ts";
import type { TargetsRow } from "./targets.ts";

export interface Bundle {
  restaurants: { id: string; name: string }[];
  vendors: { id: string; restaurant_id: string; name: string }[];
  ingredients: { id: string; restaurant_id: string; name: string; unit: string; category: string; vendor_id: string | null }[];
  menuItems: { id: string; restaurant_id: string; name: string; price_cents: number; active: boolean }[];
  recipeItems: { restaurant_id: string; menu_item_id: string; ingredient_id: string; qty: number }[];
  sales: { restaurant_id: string; sale_date: string; menu_item_id: string; units: number; sales_cents: number }[];
  /** Invoice lines with their invoice's date and vendor flattened in. */
  invoiceLines: { restaurant_id: string; ingredient_id: string; vendor_id: string; date: string; qty: number; unit_cost_cents: number; line_total_cents: number }[];
  labor: { restaurant_id: string; entry_date: string; labor_cents: number }[];
  counts: { restaurant_id: string; ingredient_id: string; count_date: string; qty: number }[];
  /** Saved targets for the signed-in user, by restaurant. Restaurants without a row use defaults. */
  targets: Map<string, TargetsRow>;
}

export const emptyBundle = (): Bundle => ({
  restaurants: [], vendors: [], ingredients: [], menuItems: [], recipeItems: [], sales: [], invoiceLines: [],
  labor: [], counts: [], targets: new Map(),
});

export interface Needs { sales?: DateRange; invoices?: DateRange; labor?: DateRange; counts?: DateRange; recipes?: boolean }

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

async function fetchAll<T>(name: string, page: (from: number, to: number) => Page): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`loading ${name} failed`); // the message can name tables; keep it out of responses
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function loadBundle(db: SupabaseClient, userId: string, restaurantIds: string[], needs: Needs): Promise<Bundle> {
  const ids = restaurantIds;
  const bundle = emptyBundle();

  bundle.restaurants = await fetchAll("restaurants", (a, b) => db.from("restaurants").select("id, name").in("id", ids).order("name").range(a, b));
  bundle.vendors = await fetchAll("vendors", (a, b) => db.from("vendors").select("id, restaurant_id, name").in("restaurant_id", ids).order("id").range(a, b));
  bundle.ingredients = await fetchAll("ingredients", (a, b) => db.from("ingredients").select("id, restaurant_id, name, unit, category, vendor_id").in("restaurant_id", ids).order("id").range(a, b));
  bundle.menuItems = await fetchAll("menu items", (a, b) => db.from("menu_items").select("id, restaurant_id, name, price_cents, active").in("restaurant_id", ids).order("id").range(a, b));

  const targetRows = await fetchAll<TargetsRow & { restaurant_id: string }>("targets", (a, b) =>
    db.from("user_targets").select("restaurant_id, food_cost_pct, labor_pct, prime_cost_pct, margin_pct, category_targets").eq("user_id", userId).in("restaurant_id", ids).range(a, b));
  for (const t of targetRows) bundle.targets.set(t.restaurant_id, t);

  if (needs.recipes) {
    bundle.recipeItems = await fetchAll("recipes", (a, b) => db.from("recipe_items").select("restaurant_id, menu_item_id, ingredient_id, qty").in("restaurant_id", ids).order("id").range(a, b));
  }
  if (needs.sales) {
    const r = needs.sales;
    bundle.sales = await fetchAll("sales", (a, b) =>
      db.from("sales_items").select("restaurant_id, sale_date, menu_item_id, units, sales_cents").in("restaurant_id", ids).gte("sale_date", r.start).lte("sale_date", r.end).order("id").range(a, b));
  }
  if (needs.labor) {
    const r = needs.labor;
    bundle.labor = await fetchAll("labor", (a, b) =>
      db.from("labor_entries").select("restaurant_id, entry_date, labor_cents").in("restaurant_id", ids).gte("entry_date", r.start).lte("entry_date", r.end).order("id").range(a, b));
  }
  if (needs.counts) {
    const r = needs.counts;
    bundle.counts = await fetchAll("inventory counts", (a, b) =>
      db.from("inventory_counts").select("restaurant_id, ingredient_id, count_date, qty").in("restaurant_id", ids).gte("count_date", r.start).lte("count_date", r.end).order("id").range(a, b));
  }
  if (needs.invoices) {
    const r = needs.invoices;
    type Raw = {
      restaurant_id: string; ingredient_id: string; qty: number; unit_cost_cents: number; line_total_cents: number;
      invoices: { invoice_date: string; vendor_id: string } | { invoice_date: string; vendor_id: string }[];
    };
    const raw = await fetchAll<Raw>("invoice lines", (a, b) =>
      db.from("invoice_items")
        .select("restaurant_id, ingredient_id, qty, unit_cost_cents, line_total_cents, invoices!inner(invoice_date, vendor_id)")
        .in("restaurant_id", ids).gte("invoices.invoice_date", r.start).lte("invoices.invoice_date", r.end).order("id").range(a, b));
    bundle.invoiceLines = raw.map((x) => {
      const inv = Array.isArray(x.invoices) ? x.invoices[0] : x.invoices;
      return {
        restaurant_id: x.restaurant_id, ingredient_id: x.ingredient_id, vendor_id: inv.vendor_id, date: inv.invoice_date,
        qty: Number(x.qty), unit_cost_cents: Number(x.unit_cost_cents), line_total_cents: Number(x.line_total_cents),
      };
    });
  }
  return bundle;
}
