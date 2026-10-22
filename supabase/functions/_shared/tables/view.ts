// A saved dashboard view: which tables show and in what order, their columns, sort, filters and grouping,
// plus the period and comparison. Stored as JSON in public.dashboard_views.config, validated here on the way
// in and out. Pure functions only, so the same code runs in the browser and in tests.
import { z } from "zod";
import { COMPARISONS, resolvePeriod, type PeriodPreset } from "../metrics/index.ts";
import { TABLE_DEFS } from "./definitions.ts";
import { filtersSchema, periodSchema, sortSchema } from "./schema.ts";
import { CATEGORIES, TABLE_IDS, type TableId } from "./types.ts";

export const MAX_SAVED_VIEWS = 25;

export const viewNameSchema = z.string().trim().min(1, "Give the view a name").max(60, "Keep the name under 60 characters");

export const tableViewSchema = z
  .object({
    id: z.enum(TABLE_IDS),
    visible: z.boolean(),
    columns: z.array(z.object({ id: z.string().min(1).max(40), visible: z.boolean() }).strict()).max(30),
    sort: sortSchema.optional(),
    filters: filtersSchema.default({}),
    groupBy: z.string().min(1).max(20).nullable().optional(),
  })
  .strict();

export const viewConfigSchema = z
  .object({
    version: z.literal(1),
    period: periodSchema,
    comparison: z.enum(COMPARISONS),
    tables: z.array(tableViewSchema).max(20),
  })
  .strict()
  .refine((v) => new Set(v.tables.map((t) => t.id)).size === v.tables.length, "each table can appear once");

export type TableView = z.infer<typeof tableViewSchema>;
export type ViewConfig = z.infer<typeof viewConfigSchema>;

const pct = z.number().min(0, "Use 0 to 100").max(100, "Use 0 to 100");
/** Targets a user can save for one restaurant. null means "not set". */
export const targetsInputSchema = z
  .object({
    food_cost_pct: pct.nullable(),
    labor_pct: pct.nullable(),
    prime_cost_pct: pct.nullable(),
    margin_pct: pct.nullable(),
    category_targets: z.object(Object.fromEntries(CATEGORIES.map((c) => [c, pct.optional()]))).strict(),
  })
  .strict();
export type TargetsInput = z.infer<typeof targetsInputSchema>;

// ---- Defaults and loading --------------------------------------------------------------------

export function defaultTableView(id: TableId): TableView {
  const def = TABLE_DEFS[id];
  return { id, visible: true, columns: def.columns.map((c) => ({ id: c.id, visible: c.defaultVisible })), filters: {} };
}

export function defaultView(): ViewConfig {
  return { version: 1, period: { preset: "last_week" }, comparison: "previous_period", tables: TABLE_IDS.map(defaultTableView) };
}

const validPeriod = (p: ViewConfig["period"]) => resolvePeriod(p.preset as PeriodPreset, "2026-01-15", { start: p.start, end: p.end }).ok;

/**
 * Turns stored JSON into a usable view. Anything invalid falls back to the default, and the result is
 * reconciled with today's table definitions: removed tables and columns are dropped, new ones are added.
 * This is what lets us add a table later without migrating anyone's saved layout.
 */
export function loadViewConfig(raw: unknown): ViewConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return defaultView();
  const obj = raw as Record<string, unknown>;
  const tables = Array.isArray(obj.tables)
    ? obj.tables.filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null && (TABLE_IDS as readonly string[]).includes(String((t as { id?: unknown }).id)))
    : [];
  const parsed = viewConfigSchema.safeParse({ ...obj, tables });
  if (!parsed.success) return defaultView();
  const config = parsed.data;
  const period = validPeriod(config.period) ? config.period : defaultView().period;

  const reconciled = config.tables.map((t) => {
    const def = TABLE_DEFS[t.id];
    const known = new Set(def.columns.map((c) => c.id));
    const kept = t.columns.filter((c, i, all) => known.has(c.id) && all.findIndex((x) => x.id === c.id) === i);
    const missingCols = def.columns.filter((c) => !kept.some((k) => k.id === c.id)).map((c) => ({ id: c.id, visible: c.defaultVisible }));
    const columns = [...kept, ...missingCols];
    const sortable = (col: string) => def.columns.some((c) => c.id === col && c.sortable);
    const groupOk = t.groupBy === null || t.groupBy === undefined || def.groupings.some((g) => g.id === t.groupBy);
    return {
      ...t,
      columns: columns.some((c) => c.visible) ? columns : defaultTableView(t.id).columns,
      sort: t.sort && sortable(t.sort.column) ? t.sort : undefined,
      groupBy: groupOk ? t.groupBy : undefined,
    };
  });
  const absent = TABLE_IDS.filter((id) => !reconciled.some((t) => t.id === id)).map(defaultTableView);
  return { ...config, period, tables: [...reconciled, ...absent] };
}

// ---- Layout operations (all immutable) -------------------------------------------------------

function moveBy<T>(items: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= items.length || index >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export const setPeriod = (v: ViewConfig, period: ViewConfig["period"]): ViewConfig => ({ ...v, period });
export const setComparison = (v: ViewConfig, comparison: ViewConfig["comparison"]): ViewConfig => ({ ...v, comparison });

export function updateTable(v: ViewConfig, id: TableId, patch: Partial<Omit<TableView, "id">>): ViewConfig {
  return { ...v, tables: v.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

export const setTableVisible = (v: ViewConfig, id: TableId, visible: boolean) => updateTable(v, id, { visible });

export function moveTable(v: ViewConfig, id: TableId, delta: -1 | 1): ViewConfig {
  return { ...v, tables: moveBy(v.tables, v.tables.findIndex((t) => t.id === id), delta) };
}

/** At least one column always stays visible, so a table can never be emptied by accident. */
export function setColumnVisible(v: ViewConfig, tableId: TableId, columnId: string, visible: boolean): ViewConfig {
  const table = v.tables.find((t) => t.id === tableId);
  if (!table) return v;
  const columns = table.columns.map((c) => (c.id === columnId ? { ...c, visible } : c));
  return columns.some((c) => c.visible) ? updateTable(v, tableId, { columns }) : v;
}

export function moveColumn(v: ViewConfig, tableId: TableId, columnId: string, delta: -1 | 1): ViewConfig {
  const table = v.tables.find((t) => t.id === tableId);
  if (!table) return v;
  return updateTable(v, tableId, { columns: moveBy(table.columns, table.columns.findIndex((c) => c.id === columnId), delta) });
}

export function resetTable(v: ViewConfig, id: TableId): ViewConfig {
  const fresh = defaultTableView(id);
  return updateTable(v, id, { columns: fresh.columns, sort: undefined, filters: {}, groupBy: undefined });
}
