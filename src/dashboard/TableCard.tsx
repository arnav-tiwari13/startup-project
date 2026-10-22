import { useEffect, useMemo, useState } from "react";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import type { Filters } from "../../supabase/functions/_shared/tables/schema.ts";
import { CATEGORY_LABELS, type Category, type FilterDef } from "../../supabase/functions/_shared/tables/types.ts";
import { moveColumn, setColumnVisible, type TableView, type ViewConfig } from "../../supabase/functions/_shared/tables/view.ts";
import { fetchTable, type TableRequestInput } from "./api";
import { downloadCsv, toCsv } from "./csv";
import DataTable from "./DataTable";
import { FLAG_LABELS, formatPeriod } from "./format";
import { useDebounced, useTable } from "./hooks";

const PAGE = 100;
const MAX_EXPORT = 500;
const fieldClass = "rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink focus-visible:border-accent";
const buttonClass = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50";

/** Drops empty filter values so they are not sent. */
const cleanFilters = (f: Filters): Filters => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && v !== false)) as Filters;

function comparisonText(kind: ViewConfig["comparison"], range: { start: string; end: string } | null) {
  if (kind === "target") return "vs your targets";
  const label = kind === "previous_period" ? "vs previous period" : "vs same period last year";
  return range ? `${label} (${formatPeriod(range)})` : label;
}

export default function TableCard({ view, config, refreshKey, onChange }: {
  view: TableView;
  config: ViewConfig;
  refreshKey: number;
  onChange: (fn: (c: ViewConfig) => ViewConfig) => void;
}) {
  const def = TABLE_DEFS[view.id];
  const [limit, setLimit] = useState(PAGE);
  const [exporting, setExporting] = useState<string | null>(null);

  // The search box types freely, then updates the saved filter once typing pauses.
  const [search, setSearch] = useState(view.filters.search ?? "");
  const debouncedSearch = useDebounced(search, 350);
  useEffect(() => {
    if ((view.filters.search ?? "") === debouncedSearch) return;
    patch({ filters: { ...view.filters, search: debouncedSearch || undefined } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const patch = (p: Partial<TableView>) => onChange((c) => ({ ...c, tables: c.tables.map((t) => (t.id === view.id ? { ...t, ...p } : t)) }));
  const sort = view.sort ?? def.defaultSort;

  const request: TableRequestInput = useMemo(
    () => ({
      tableId: view.id, period: config.period, comparison: config.comparison, sort: view.sort,
      filters: cleanFilters(view.filters), groupBy: view.groupBy, limit, offset: 0,
    }),
    [view.id, view.sort, view.filters, view.groupBy, config.period, config.comparison, limit],
  );
  const { data, loading, error, reload } = useTable(request, refreshKey);

  // With more than one location, rows are meaningless without knowing which location they belong to.
  const multiLocation = (data?.filterOptions.location.length ?? 0) > 1;
  const alwaysShow = (id: string) => multiLocation && id === "location";
  const columns = view.columns.filter((c) => c.visible || alwaysShow(c.id)).map((c) => def.columns.find((d) => d.id === c.id)!).filter(Boolean);
  const onSort = (column: string) => patch({ sort: { column, dir: sort.column === column && sort.dir === "desc" ? "asc" : "desc" } });
  const groupValue = view.groupBy === undefined ? def.defaultGroupBy ?? "" : view.groupBy ?? "";

  const exportCsv = async () => {
    setExporting("Preparing…");
    try {
      const all = await fetchTable({ ...request, limit: MAX_EXPORT, offset: 0 });
      downloadCsv(`${def.id}_${all.period.start}_${all.period.end}.csv`, toCsv(columns, all.rows));
      setExporting(all.total > all.rows.length ? `Exported the first ${all.rows.length} of ${all.total} rows.` : null);
    } catch {
      setExporting("Couldn't export. Please try again.");
    }
  };

  const options = data?.filterOptions;
  const selectFor = (f: FilterDef) => {
    const value = (view.filters[f.id as keyof Filters] as string | undefined) ?? "";
    const set = (v: string) => patch({ filters: { ...view.filters, [f.id]: v || undefined } });
    const choices: { value: string; label: string }[] =
      f.id === "vendor" ? (options?.vendor ?? []).map((v) => ({ value: v, label: v }))
      : f.id === "category" ? (options?.category ?? []).map((c) => ({ value: c, label: CATEGORY_LABELS[c as Category] ?? c }))
      : f.id === "location" ? (options?.location ?? []).map((l) => ({ value: l.id, label: l.name }))
      : Object.entries(FLAG_LABELS).map(([value, label]) => ({ value, label }));
    if (f.id === "location" && choices.length < 2) return null; // nothing to choose between
    return (
      <label key={f.id} className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {f.label}
        <select value={value} onChange={(e) => set(e.target.value)} className={fieldClass}>
          <option value="">{f.id === "flag" ? "Any" : "All"}</option>
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
    );
  };

  const isEmpty = !!data && data.rows.length === 0;
  const hasFilters = Object.keys(cleanFilters(view.filters)).length > 0;

  return (
    <section aria-labelledby={`t-${view.id}`} className="rounded-2xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 id={`t-${view.id}`} className="text-lg font-bold">{def.title}</h2>
          <p className="text-sm text-muted">{def.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className={`${buttonClass} cursor-pointer list-none`}>Columns</summary>
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-surface p-2 shadow-card">
              <ul className="max-h-72 overflow-y-auto">
                {view.columns.map((c, i) => {
                  const d = def.columns.find((x) => x.id === c.id);
                  if (!d) return null;
                  return (
                    <li key={c.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-bg">
                      <label className="flex min-w-0 flex-1 items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox" checked={c.visible || alwaysShow(c.id)} disabled={alwaysShow(c.id)}
                          onChange={(e) => onChange((cfg) => setColumnVisible(cfg, view.id, c.id, e.target.checked))} className="accent-[var(--accent)]"
                        />
                        <span className="truncate" title={alwaysShow(c.id) ? "Always shown when you have more than one location" : undefined}>{d.label}</span>
                      </label>
                      <button type="button" aria-label={`Move ${d.label} left`} disabled={i === 0} onClick={() => onChange((cfg) => moveColumn(cfg, view.id, c.id, -1))} className="h-7 w-7 rounded-md text-muted hover:bg-line disabled:opacity-30">{"↑"}</button>
                      <button type="button" aria-label={`Move ${d.label} right`} disabled={i === view.columns.length - 1} onClick={() => onChange((cfg) => moveColumn(cfg, view.id, c.id, 1))} className="h-7 w-7 rounded-md text-muted hover:bg-line disabled:opacity-30">{"↓"}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
          <button type="button" onClick={exportCsv} disabled={!data || isEmpty || exporting === "Preparing…"} className={buttonClass}>Export CSV</button>
          <button type="button" onClick={() => onChange((c) => ({ ...c, tables: c.tables.map((t) => (t.id === view.id ? { ...t, visible: false } : t)) }))} className={buttonClass} aria-label={`Hide ${def.title}`}>Hide</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3">
        {(def.groupings.length > 0) && (
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
            Group by
            <select value={groupValue} onChange={(e) => patch({ groupBy: e.target.value === "" ? null : e.target.value })} className={fieldClass}>
              {def.ungroupedLabel && <option value="">{def.ungroupedLabel}</option>}
              {def.groupings.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        )}
        {def.filters.filter((f) => f.kind === "select").map(selectFor)}
        {def.filters.some((f) => f.id === "search") && (
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
            Search
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60} placeholder="Name" className={`${fieldClass} w-36`} />
          </label>
        )}
        {def.filters.some((f) => f.id === "only_increases") && (
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <input type="checkbox" checked={!!view.filters.only_increases} onChange={(e) => patch({ filters: { ...view.filters, only_increases: e.target.checked || undefined } })} className="accent-[var(--accent)]" />
            Only increases
          </label>
        )}
        {hasFilters && <button type="button" onClick={() => { setSearch(""); patch({ filters: {} }); }} className="text-xs font-medium text-accent hover:underline">Clear filters</button>}
      </div>

      {data && (
        <p className="px-5 pt-3 text-xs text-muted">
          {formatPeriod(data.period)} · {comparisonText(data.comparison.kind, data.comparison.range)}
          {data.lastUpdated ? ` · Data through ${formatPeriod({ start: data.lastUpdated, end: data.lastUpdated })}` : " · No data yet"}
        </p>
      )}
      {data?.notes.map((n) => <p key={n} className="px-5 pt-1 text-xs text-muted">{n}</p>)}

      <div className="mt-3">
        {error && (
          <div role="alert" className="mx-5 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-bad/40 bg-bad-bg px-4 py-3 text-sm text-bad">
            {error}
            <button type="button" onClick={reload} className="rounded-lg border border-bad/40 px-3 py-1 font-medium hover:bg-bad/10">Try again</button>
          </div>
        )}
        {!data && loading && !error && (
          <div className="space-y-2 px-5 pb-5" role="status" aria-label={`Loading ${def.title}`}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-line/60" />)}
          </div>
        )}
        {data && !isEmpty && columns.length > 0 && <DataTable columns={columns} rows={data.rows} sort={sort} onSort={onSort} busy={loading} />}
        {isEmpty && (
          <p className="px-5 pb-6 pt-2 text-sm text-muted">
            {hasFilters ? "Nothing matches these filters." : "No data for this period yet. Try a different period, or check that invoices, sales and recipes are loaded."}
          </p>
        )}
        {data && !isEmpty && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-muted">
            <span aria-live="polite">Showing {data.rows.length} of {data.total}</span>
            <span className="flex items-center gap-3">
              {exporting && exporting !== "Preparing…" && <span>{exporting}</span>}
              {data.rows.length < data.total && limit < MAX_EXPORT && (
                <button type="button" onClick={() => setLimit((l) => Math.min(l + PAGE, MAX_EXPORT))} className="font-medium text-accent hover:underline">Show more</button>
              )}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
