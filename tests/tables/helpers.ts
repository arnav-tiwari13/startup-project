import { generateSeed, type SeedRows } from "../../scripts/seed/generate.ts";
import { chooseRestaurants, executeTable, planTable, tableRequestSchema, type Bundle, type TableRequest, type TableResponse } from "../../supabase/functions/_shared/tables/index.ts";
import { CEDAR_LANE, ROLLING_TACOS } from "../../scripts/seed/specs.ts";

export const TODAY = "2026-10-21";
export const A = CEDAR_LANE.id;
export const B = ROLLING_TACOS.id;
export const SEED: SeedRows = generateSeed(TODAY);

export function bundleFrom(seed: SeedRows = SEED): Bundle {
  const invoiceDate = new Map(seed.invoices.map((i) => [i.id, i]));
  return {
    restaurants: [...seed.restaurants].sort((a, b) => a.name.localeCompare(b.name)),
    vendors: seed.vendors,
    ingredients: seed.ingredients,
    menuItems: seed.menu_items.map((m) => ({ ...m, active: true })),
    recipeItems: seed.recipe_items,
    sales: seed.sales_items,
    invoiceLines: seed.invoice_items.map((l) => ({
      restaurant_id: l.restaurant_id, ingredient_id: l.ingredient_id, vendor_id: invoiceDate.get(l.invoice_id)!.vendor_id,
      date: invoiceDate.get(l.invoice_id)!.invoice_date, qty: l.qty, unit_cost_cents: l.unit_cost_cents, line_total_cents: l.line_total_cents,
    })),
    labor: seed.labor_entries,
    counts: seed.inventory_counts,
    targets: new Map(),
  };
}

type Input = Partial<Omit<TableRequest, "tableId">> & { tableId: TableRequest["tableId"] };

/** Parses like the Edge Function does, plans, and executes. Throws if the request is invalid. */
export function run(input: Input, ids: string[] = [A, B], bundle: Bundle = bundleFrom()): TableResponse {
  const req = tableRequestSchema.parse(input);
  const planned = planTable(req, TODAY);
  if (!planned.ok) throw new Error(planned.error);
  const chosen = chooseRestaurants(req.restaurantIds, ids);
  if (!chosen.ok) throw new Error("forbidden");
  return executeTable(planned.plan, bundle, chosen.ids);
}

export const cell = (res: TableResponse, key: string, col: string) => res.rows.find((r) => r.key === key)!.cells[col];
