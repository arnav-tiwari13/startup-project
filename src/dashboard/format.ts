// Turns table cells into text. Used by the on-screen table and the CSV export so they never disagree.
import { MISSING_LABEL, type Rating } from "../../supabase/functions/_shared/metrics/index.ts";
import type { Cell, ColumnKind } from "../../supabase/functions/_shared/tables/types.ts";

export const FLAG_LABELS: Record<string, string> = {
  plowhorse: "Low margin, high sales",
  puzzle: "High margin, low sales",
};

const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const unitPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });
const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const MINUS = "−"; // a real minus sign lines up better than a hyphen

const signed = (n: number, text: string) => (n > 0 ? `+${text}` : n < 0 ? `${MINUS}${text.replace(/^-/, "")}` : text);

/** What to show for a cell's value. Missing data gets words, never a number. */
export function formatValue(kind: ColumnKind, cell: Cell): string {
  if (cell.value === null) return cell.missing ? "Missing data" : "—";
  if (typeof cell.value === "string") return kind === "flag" ? FLAG_LABELS[cell.value] ?? cell.value : cell.value;
  const v = cell.value;
  switch (kind) {
    case "cents": return v < 0 ? `${MINUS}${usd2.format(-v / 100)}` : usd2.format(v / 100);
    case "cents_unit": return `${unitPrice.format(v / 100)}${cell.unit ? `/${cell.unit}` : ""}`;
    case "pct": return `${v.toFixed(1)}%`;
    case "qty": return `${v < 0 ? MINUS : ""}${qty.format(Math.abs(v))}${cell.unit ? ` ${cell.unit}` : ""}`;
    case "count": return whole.format(v);
    default: return String(v);
  }
}

/** The tooltip text explaining a missing cell, e.g. "Inventory count is missing". */
export const missingText = (cell: Cell): string | null => (cell.missing ? MISSING_LABEL[cell.missing] : null);

/** The small "vs previous" line under a value, e.g. "+2.1 pts" or "−4.0%". Null when there is nothing honest to show. */
export function formatCompare(cell: Cell): string | null {
  const c = cell.compare;
  if (!c || c.value === null) return null;
  const n = Math.abs(c.value) < 0.05 ? 0 : c.value;
  return c.unit === "pct" ? `${signed(n, `${n.toFixed(1)}%`)}` : `${signed(n, `${n.toFixed(1)} pts`)}`;
}

export const RATING_TEXT: Record<Rating, { icon: string; label: string }> = {
  good: { icon: "✓", label: "On target" },
  watch: { icon: "!", label: "Close to target" },
  bad: { icon: "✕", label: "Off target" },
  unknown: { icon: "", label: "" },
};

export function formatPeriod(range: { start: string; end: string }): string {
  const f = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return range.start === range.end ? f(range.start) : `${f(range.start)} – ${f(range.end)}`;
}
