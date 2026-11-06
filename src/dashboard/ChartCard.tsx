import { useMemo } from "react";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import type { TableView, ViewConfig } from "../../supabase/functions/_shared/tables/view.ts";
import { useAi } from "../ai/AiContext";
import { buildAsked, buildRef, type Target } from "../ai/ref";
import type { TableRequestInput } from "./api";
import { formatPeriod, formatValue } from "./format";
import { useTable } from "./hooks";
import { cleanFilters } from "./TableCard";

const H = 180;
const BAR = 16;
const GAP = 4;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

/** The daily sales chart. One bar per day; in AI mode each bar is a clickable data point. */
export default function ChartCard({ view, config, refreshKey, onChange }: {
  view: TableView;
  config: ViewConfig;
  refreshKey: number;
  onChange: (fn: (c: ViewConfig) => ViewConfig) => void;
}) {
  const def = TABLE_DEFS[view.id];
  const request: TableRequestInput = useMemo(
    () => ({ tableId: view.id, period: config.period, comparison: config.comparison, filters: cleanFilters(view.filters), limit: 500, offset: 0 }),
    [view.id, view.filters, config.period, config.comparison],
  );
  const { data, loading, error, reload } = useTable(request, refreshKey);
  const ai = useAi();

  const periodText = data ? formatPeriod(data.period) : "";
  const askAbout = (target: Target, item?: string) => ai.ask(buildAsked(buildRef(view.id, target, request), { item, periodText }));

  const points = (data?.rows ?? []).map((r) => ({ date: String(r.cells.date.value), cents: typeof r.cells.sales.value === "number" ? r.cells.sales.value : 0, cell: r.cells.sales }));
  const max = Math.max(1, ...points.map((p) => p.cents));
  const width = Math.max(points.length * (BAR + GAP), 1);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const isEmpty = !!data && points.length === 0;

  return (
    <section
      aria-labelledby={`t-${view.id}`}
      onClick={(e) => { if (ai.enabled && data && !(e.target as HTMLElement).closest("button, [role=button]")) askAbout({ kind: "widget" }); }}
      className={`rounded-2xl border bg-surface shadow-card ${ai.enabled ? "cursor-pointer border-accent/40 hover:border-accent hover:ring-2 hover:ring-accent/30" : "border-line"}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 id={`t-${view.id}`} className="text-lg font-bold">{def.title}</h2>
          <p className="text-sm text-muted">{def.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ai.enabled && (
            <button type="button" onClick={() => askAbout({ kind: "widget" })} disabled={!data} className="rounded-lg border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50" aria-label={`Ask AI about ${def.title}`}>✦ Ask AI</button>
          )}
          <button
            type="button" aria-label={`Hide ${def.title}`}
            onClick={() => onChange((c) => ({ ...c, tables: c.tables.map((t) => (t.id === view.id ? { ...t, visible: false } : t)) }))}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent hover:text-accent"
          >Hide</button>
        </div>
      </header>

      {data && (
        <p className="px-5 pt-3 text-xs text-muted">
          {formatPeriod(data.period)}{data.lastUpdated ? ` · Data through ${formatPeriod({ start: data.lastUpdated, end: data.lastUpdated })}` : " · No data yet"}
        </p>
      )}

      <div className="mt-3 pb-5">
        {error && (
          <div role="alert" className="mx-5 flex flex-wrap items-center gap-3 rounded-xl border border-bad/40 bg-bad-bg px-4 py-3 text-sm text-bad">
            {error}
            <button type="button" onClick={reload} className="rounded-lg border border-bad/40 px-3 py-1 font-medium hover:bg-bad/10">Try again</button>
          </div>
        )}
        {!data && loading && !error && <div role="status" aria-label={`Loading ${def.title}`} className="mx-5 h-44 animate-pulse rounded-lg bg-line/60" />}
        {isEmpty && <p className="px-5 text-sm text-muted">No sales for this period yet. Try a different period, or check that sales are loaded.</p>}
        {data && !isEmpty && (
          <div className={`overflow-x-auto px-5 ${loading ? "opacity-60 transition-opacity" : ""}`} aria-busy={loading}>
            <svg viewBox={`0 0 ${width} ${H}`} width={Math.max(width, 280)} height={H} role="group" aria-label={`${def.title}, one bar per day`} className="block max-w-none" preserveAspectRatio="xMinYMid meet">
              <line x1={0} x2={width} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} stroke="var(--line)" />
              {points.map((p, i) => {
                const h = Math.max(1, (p.cents / max) * plotH);
                const x = i * (BAR + GAP);
                const label = `${p.date}: ${formatValue("cents", p.cell)}`;
                const interactive = ai.enabled;
                return (
                  <g
                    key={p.date}
                    {...(interactive ? {
                      role: "button", tabIndex: 0, "aria-label": `Ask AI about ${label}`, style: { cursor: "pointer", outline: "none" },
                      onClick: (e: React.MouseEvent) => { e.stopPropagation(); askAbout({ kind: "point", date: p.date }, p.date); },
                      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); askAbout({ kind: "point", date: p.date }, p.date); } },
                    } : {})}
                    className="group/point"
                  >
                    <title>{label}</title>
                    {/* a wider invisible target so a bar is easy to hit with a finger */}
                    <rect x={x - GAP / 2} y={0} width={BAR + GAP} height={H - PAD_BOTTOM} fill="transparent" />
                    <rect x={x} y={H - PAD_BOTTOM - h} width={BAR} height={h} rx={3} fill="var(--accent)" opacity={interactive ? 0.85 : 0.7} className="group-hover/point:opacity-100 group-focus-visible/point:opacity-100" />
                    {interactive && <rect x={x - 1} y={H - PAD_BOTTOM - h - 1} width={BAR + 2} height={h + 2} rx={4} fill="none" stroke="var(--accent)" strokeWidth={2} className="opacity-0 group-hover/point:opacity-100 group-focus-visible/point:opacity-100" />}
                  </g>
                );
              })}
              <text x={0} y={H - 6} fontSize={10} fill="var(--muted)">{points[0].date.slice(5)}</text>
              <text x={width} y={H - 6} fontSize={10} fill="var(--muted)" textAnchor="end">{points[points.length - 1].date.slice(5)}</text>
              <text x={0} y={10} fontSize={10} fill="var(--muted)">{formatValue("cents", { value: max })}</text>
            </svg>
          </div>
        )}
        {ai.enabled && data && !isEmpty && <p className="px-5 pt-2 text-xs text-muted">Click a bar to ask about that day.</p>}
      </div>
    </section>
  );
}
