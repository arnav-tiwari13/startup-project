import type { ColumnDef, Row, Cell } from "../../supabase/functions/_shared/tables/types.ts";
import { RATING_TEXT, formatCompare, formatValue, missingText } from "./format";

/** A small "i" that explains a column. Works on hover, keyboard focus and tap. */
function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`How this is calculated: ${text}`}
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] font-bold leading-none text-muted hover:border-accent hover:text-accent focus-visible:border-accent"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-56 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-ink shadow-card group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

const RATING_STYLE = { good: "bg-good-bg text-good", watch: "bg-watch-bg text-watch", bad: "bg-bad-bg text-bad", unknown: "" } as const;
const NUMERIC = new Set(["cents", "cents_unit", "pct", "qty", "count"]);

function CellView({ column, cell }: { column: ColumnDef; cell: Cell }) {
  const numeric = NUMERIC.has(column.kind);
  const align = numeric ? "items-end text-right" : "items-start text-left";

  if (cell.value === null) {
    const why = missingText(cell);
    return (
      <div className={`flex flex-col ${align}`}>
        <span className={why ? "italic text-muted underline decoration-dotted underline-offset-4" : "text-muted"} title={why ?? undefined} aria-label={why ? `Missing data: ${why}` : undefined}>
          {formatValue(column.kind, cell)}
        </span>
      </div>
    );
  }

  const compare = formatCompare(cell);
  const rating = cell.rating && cell.rating !== "unknown" ? RATING_TEXT[cell.rating] : null;
  return (
    <div className={`flex flex-col ${align}`}>
      <span className={`inline-flex items-center gap-1 tabular-nums ${rating ? `rounded-md px-1.5 py-0.5 font-semibold ${RATING_STYLE[cell.rating!]}` : ""}`}>
        {rating && <span aria-hidden className="text-xs">{rating.icon}</span>}
        {formatValue(column.kind, cell)}
        {rating && <span className="sr-only">{`, ${rating.label.toLowerCase()}`}</span>}
      </span>
      {compare && <span className="mt-0.5 text-xs tabular-nums text-muted" title="Change versus the comparison you chose">{compare}</span>}
    </div>
  );
}

/** In AI mode, rows and cells can be clicked to ask about them. Only references (row key, column id) leave the table. */
export interface AskHandlers { onRow: (row: Row) => void; onCell: (row: Row, column: ColumnDef) => void }

function activate(fn: () => void) {
  return {
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); fn(); },
    onKeyDown: (e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
    },
  };
}

export default function DataTable({ columns, rows, sort, onSort, busy, ask }: {
  ask?: AskHandlers;
  columns: ColumnDef[];
  rows: Row[];
  sort: { column: string; dir: "asc" | "desc" };
  onSort: (column: string) => void;
  busy: boolean;
}) {
  return (
    // min-h leaves room for a header tooltip to open without being clipped, even when there is only one row.
    <div className={`min-h-44 overflow-x-auto ${busy ? "opacity-60 transition-opacity" : ""}`} aria-busy={busy}>
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {columns.map((c, i) => {
              const active = sort.column === c.id;
              const numeric = NUMERIC.has(c.kind);
              return (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted ${numeric ? "text-right" : "text-left"} ${i === 0 ? "sticky left-0 z-10" : ""}`}
                >
                  <span className={`inline-flex items-center ${numeric ? "justify-end" : ""}`}>
                    {c.sortable ? (
                      <button type="button" onClick={() => onSort(c.id)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
                        {c.label}
                        <span aria-hidden className={active ? "text-accent" : "opacity-30"}>{active ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </button>
                    ) : (
                      c.label
                    )}
                    <Hint text={c.tooltip} />
                  </span>
                </th>
              );
            })}
            {ask && <th scope="col" className="border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted"><span className="sr-only">Ask AI</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={`group/row hover:bg-bg/60 ${ask ? "hover:bg-accent/5" : ""}`}>
              {columns.map((c, i) => (
                <td
                  key={c.id}
                  {...(ask ? { ...activate(() => ask.onCell(row, c)), role: "button", tabIndex: 0, "aria-label": `Ask AI about ${c.label}`, title: "Ask AI about this value" } : {})}
                  className={`border-b border-line px-4 py-2.5 align-top ${i === 0 ? "sticky left-0 z-[1] bg-surface font-medium group-hover/row:bg-bg" : ""} ${ask ? "cursor-pointer outline-offset-[-2px] hover:bg-accent/10 hover:outline hover:outline-2 hover:outline-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" : ""}`}
                >
                  <CellView column={c} cell={row.cells[c.id] ?? { value: null }} />
                </td>
              ))}
              {ask && (
                <td className="border-b border-line px-3 py-2.5 align-top">
                  <button type="button" onClick={(e) => { e.stopPropagation(); ask.onRow(row); }} aria-label={`Ask AI about this row`} className="whitespace-nowrap rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-bg">
                    ✦ Ask AI
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
