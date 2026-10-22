// Loads sample data for the two sample restaurants into the dashboard tables.
//
//   SUPABASE_SERVICE_ROLE_KEY=... SEED_CONFIRM=sample-data npm run seed
//   npm run seed -- --dry-run            (prints row counts, touches nothing, needs no keys)
//   npm run seed -- --as-of=2026-10-21   (default: today, UTC)
//
// This is a manual command, never part of the build, a migration or a deploy. It only ever deletes and
// reloads rows belonging to the two sample restaurant ids below, and refuses to run without SEED_CONFIRM.
import { createClient } from "@supabase/supabase-js";
import { isIsoDate } from "../supabase/functions/_shared/metrics/periods.ts";
import { generateSeed, type SeedRows } from "./seed/generate.ts";
import { SAMPLE_SPECS } from "./seed/specs.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const asOfArg = args.find((a) => a.startsWith("--as-of="))?.slice("--as-of=".length);
const asOf = asOfArg ?? new Date().toISOString().slice(0, 10);
if (!isIsoDate(asOf)) throw new Error(`--as-of must be YYYY-MM-DD, got "${asOf}"`);

const rows = generateSeed(asOf);
const ids = SAMPLE_SPECS.map((s) => s.id);
const tables: (keyof SeedRows)[] = [
  "restaurants", "vendors", "ingredients", "menu_items", "recipe_items", "invoices", "invoice_items",
  "sales_items", "inventory_counts", "labor_entries",
];

console.log(`Sample data as of ${asOf}:`);
for (const t of tables) console.log(`  ${t.padEnd(18)} ${rows[t].length}`);
if (dryRun) process.exit(0);

if (process.env.SEED_CONFIRM !== "sample-data") {
  console.error("Refusing to run. Set SEED_CONFIRM=sample-data to confirm you want to replace the sample restaurants' data.");
  process.exit(1);
}
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Clear only the sample restaurants' rows, children first. The restaurants and their members stay.
const clearOrder = ["sales_items", "inventory_counts", "labor_entries", "invoice_items", "invoices", "recipe_items", "menu_items", "ingredients", "vendors"];
for (const t of clearOrder) {
  const { error } = await db.from(t).delete().in("restaurant_id", ids);
  if (error) throw new Error(`clearing ${t}: ${error.message}`);
}

for (const t of tables) {
  const data = rows[t] as Record<string, unknown>[];
  for (let i = 0; i < data.length; i += 500) {
    const { error } = await db.from(t).upsert(data.slice(i, i + 500));
    if (error) throw new Error(`loading ${t}: ${error.message}`);
  }
}
console.log("Done.");
