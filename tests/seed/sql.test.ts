import { describe, expect, it } from "vitest";
import { generateSeed } from "../../scripts/seed/generate.ts";
import { toSql } from "../../scripts/seed/sql.ts";
import { SAMPLE_SPECS } from "../../scripts/seed/specs.ts";

const rows = generateSeed("2026-10-22");
const sql = toSql(rows, "2026-10-22");

const tuples = (table: string) => {
  const re = new RegExp(`insert into public\\.${table} \\([^)]*\\) values\\n([\\s\\S]*?);\\n`, "g");
  return [...sql.matchAll(re)].reduce((n, m) => n + m[1].split(/\),\n\(/).length, 0);
};

describe("seed SQL script", () => {
  it("loads every generated row", () => {
    expect(tuples("sales_items")).toBe(rows.sales_items.length);
    expect(tuples("invoice_items")).toBe(rows.invoice_items.length);
    expect(tuples("invoices")).toBe(rows.invoices.length);
    expect(tuples("inventory_counts")).toBe(rows.inventory_counts.length);
    expect(tuples("labor_entries")).toBe(rows.labor_entries.length);
    expect(tuples("recipe_items")).toBe(rows.recipe_items.length);
  });

  it("runs in one transaction and only deletes the sample restaurants' rows", () => {
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql).toMatch(/\ncommit;\n/);
    const deletes = sql.split("\n").filter((l) => l.startsWith("delete"));
    expect(deletes.length).toBe(9);
    for (const d of deletes) {
      expect(d).toMatch(/where restaurant_id in \(/);
      for (const s of SAMPLE_SPECS) expect(d).toContain(s.id);
    }
    expect(sql).not.toMatch(/\b(drop|truncate|alter)\b/i);
    expect(sql).not.toMatch(/delete from public\.restaurants/);
  });

  it("escapes quotes in names", () => {
    const tricky = { ...rows, vendors: [{ id: "x", restaurant_id: "y", name: "Joe's \"Best\"; drop table x;--" }] };
    expect(toSql(tricky, "2026-10-22")).toContain("'Joe''s \"Best\"; drop table x;--'");
  });
});
