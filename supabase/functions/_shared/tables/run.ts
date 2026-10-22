// Plans which data a table request needs, then turns loaded data into the response (filter, group, sort, page).
import { addDays, comparisonRange, resolvePeriod, type DateRange } from "../metrics/index.ts";
import {
  foodCostByCategory, ingredientPriceChanges, makeCtx, menuMargins, profitSnapshot, usageVariance, type Ctx, type Query, type TableResult,
} from "./compute.ts";
import type { Bundle, Needs } from "./data.ts";
import { TABLE_DEFS } from "./definitions.ts";
import type { TableRequest } from "./schema.ts";
import { CATEGORIES, type Row, type TableId, type TableResponse } from "./types.ts";

/** Adding a table: add its definition, write a compute function, register it here with what data it reads. */
const REGISTRY: Record<TableId, { compute: (c: Ctx) => TableResult; needs: (q: Query) => Needs }> = {
  profit_snapshot: { compute: profitSnapshot, needs: (q) => ({ sales: span(q), invoices: span(q), labor: span(q) }) },
  food_cost_by_category: { compute: foodCostByCategory, needs: (q) => ({ sales: span(q), invoices: span(q) }) },
  ingredient_price_changes: {
    compute: ingredientPriceChanges,
    needs: (q) => ({ invoices: { start: min(addDays(q.range.start, -90), addDays(q.range.end, -27)), end: q.range.end } }),
  },
  menu_margins: {
    compute: menuMargins,
    needs: (q) => {
      const s = span(q);
      return { sales: s, invoices: { start: addDays(min(q.range.end, q.prev?.end ?? q.range.end), -90), end: s.end }, recipes: true };
    },
  },
  usage_variance: {
    compute: usageVariance,
    needs: (q) => {
      const w = { start: addDays(q.range.start, -35), end: q.range.end };
      return { sales: w, invoices: w, counts: w, recipes: true };
    },
  },
};

const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);
/** The current range plus the comparison range, as one span to load. */
const span = (q: Query): DateRange => ({ start: min(q.range.start, q.prev?.start ?? q.range.start), end: max(q.range.end, q.prev?.end ?? q.range.end) });

export type PlanError = "bad_period" | "bad_group";
export interface Plan { req: TableRequest; query: Query; groupBy: string | null; needs: Needs }

/** Validates the period and grouping and works out what to load. `today` is the UTC date the presets are relative to. */
export function planTable(req: TableRequest, today: string): { ok: true; plan: Plan } | { ok: false; error: PlanError } {
  const def = TABLE_DEFS[req.tableId];
  const period = resolvePeriod(req.period.preset, today, { start: req.period.start, end: req.period.end });
  if (!period.ok) return { ok: false, error: "bad_period" };
  const groupBy = req.groupBy === undefined ? def.defaultGroupBy : req.groupBy;
  if (groupBy !== null && !def.groupings.some((g) => g.id === groupBy)) return { ok: false, error: "bad_group" };
  const query: Query = { range: period.range, prev: comparisonRange(period.range, req.comparison), comparison: req.comparison };
  return { ok: true, plan: { req, query, groupBy, needs: REGISTRY[req.tableId].needs(query) } };
}

/** Which of the caller's restaurants to use. Ids the caller is not a member of are an error, never silently ignored. */
export function chooseRestaurants(requested: string[] | undefined, memberOf: string[]): { ok: true; ids: string[] } | { ok: false } {
  if (!requested) return { ok: true, ids: [...memberOf] };
  const allowed = new Set(memberOf);
  return requested.every((id) => allowed.has(id)) ? { ok: true, ids: [...new Set(requested)] } : { ok: false };
}

const sortValue = (row: Row, column: string): number | string | null => row.cells[column]?.value ?? null;

function sortRows(rows: Row[], column: string, dir: "asc" | "desc"): Row[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, z) => {
    const x = sortValue(a, column);
    const y = sortValue(z, column);
    if (x === null && y === null) return a.key.localeCompare(z.key);
    if (x === null) return 1; // missing values always last
    if (y === null) return -1;
    const diff = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return diff === 0 ? a.key.localeCompare(z.key) : sign * diff;
  });
}

export function executeTable(plan: Plan, bundle: Bundle, ids: string[]): TableResponse {
  const { req, query, groupBy } = plan;
  const def = TABLE_DEFS[req.tableId];
  const ctx = makeCtx(bundle, ids, query, req.filters, groupBy);
  const result = REGISTRY[req.tableId].compute(ctx);

  const requested = req.sort && def.columns.some((c) => c.id === req.sort!.column && c.sortable) ? req.sort : def.defaultSort;
  const sorted = sortRows(result.rows, requested.column, requested.dir);

  const inScope = new Set(ids);
  return {
    tableId: req.tableId,
    period: query.range,
    comparison: { kind: req.comparison, range: query.prev },
    lastUpdated: result.lastUpdated,
    rows: sorted.slice(req.offset, req.offset + req.limit),
    total: sorted.length,
    groupBy,
    notes: result.notes,
    filterOptions: {
      vendor: [...new Set(bundle.vendors.filter((v) => inScope.has(v.restaurant_id)).map((v) => v.name))].sort(),
      category: CATEGORIES.filter((c) => bundle.ingredients.some((i) => inScope.has(i.restaurant_id) && i.category === c)),
      location: bundle.restaurants.filter((r) => inScope.has(r.id)).map((r) => ({ id: r.id, name: r.name })),
    },
  };
}
