// CSV export of the current table view: visible columns, in the order on screen, with raw numbers
// (dollars and percents as plain numbers) so they sort and sum in a spreadsheet.
import type { Cell, ColumnDef, Row } from "../../supabase/functions/_shared/tables/types.ts";
import { FLAG_LABELS } from "./format";

/**
 * Quotes a field when needed. Text a spreadsheet would run as a formula (starting with =, +, - or @) is
 * neutralized with a leading quote; real numbers are left alone so negatives stay numbers.
 */
export function csvField(value: string, isNumber = false): string {
  const safe = !isNumber && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

type Field = { text: string; isNumber: boolean };
const blank: Field = { text: "", isNumber: false };
const num = (n: string): Field => ({ text: n, isNumber: true });

function csvValue(col: ColumnDef, cell: Cell | undefined): Field {
  if (!cell || cell.value === null) return blank; // missing data stays blank rather than looking like zero
  if (typeof cell.value === "string") return { text: col.kind === "flag" ? FLAG_LABELS[cell.value] ?? cell.value : cell.value, isNumber: false };
  const v = cell.value;
  switch (col.kind) {
    case "cents": return num((v / 100).toFixed(2));
    case "cents_unit": return num(String(Number((v / 100).toFixed(4))));
    case "pct": return num(v.toFixed(2));
    case "qty": return num(String(Number(v.toFixed(3))));
    default: return num(String(v));
  }
}

export function toCsv(columns: ColumnDef[], rows: Row[]): string {
  // A "change" column follows each column that has a comparison on any row.
  const withChange = columns.map((c) => ({ col: c, unit: rows.map((r) => r.cells[c.id]?.compare).find((x) => x && x.value !== null)?.unit }));
  const header: string[] = [];
  for (const { col, unit } of withChange) {
    header.push(col.label);
    if (unit) header.push(`${col.label} change (${unit === "pct" ? "%" : "pts"})`);
  }
  const lines = [header.map((h) => csvField(h)).join(",")];
  for (const row of rows) {
    const fields: Field[] = [];
    for (const { col, unit } of withChange) {
      fields.push(csvValue(col, row.cells[col.id]));
      if (unit) {
        const c = row.cells[col.id]?.compare;
        fields.push(c && c.value !== null ? num(c.value.toFixed(2)) : blank);
      }
    }
    lines.push(fields.map((f) => csvField(f.text, f.isNumber)).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
