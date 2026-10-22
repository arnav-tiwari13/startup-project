// Writes supabase/seed-sample-data.sql: the same made-up data as `npm run seed`, as a script to paste into
// the Supabase SQL editor.   npm run seed:sql   (or: npm run seed:sql -- --as-of=2026-10-22)
import { writeFileSync } from "node:fs";
import { isIsoDate } from "../supabase/functions/_shared/metrics/periods.ts";
import { generateSeed } from "./seed/generate.ts";
import { toSql } from "./seed/sql.ts";

const asOfArg = process.argv.find((a) => a.startsWith("--as-of="))?.slice("--as-of=".length);
const asOf = asOfArg ?? new Date().toISOString().slice(0, 10);
if (!isIsoDate(asOf)) throw new Error(`--as-of must be YYYY-MM-DD, got "${asOf}"`);

const sql = toSql(generateSeed(asOf), asOf);
const path = new URL("../supabase/seed-sample-data.sql", import.meta.url);
writeFileSync(path, sql);
console.log(`Wrote supabase/seed-sample-data.sql (${(sql.length / 1024).toFixed(0)} KB), data as of ${asOf}.`);
