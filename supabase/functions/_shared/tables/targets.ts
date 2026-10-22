import { CATEGORIES, type Category } from "./types.ts";

export interface Targets {
  food_cost_pct: number | null;
  labor_pct: number | null;
  prime_cost_pct: number | null;
  margin_pct: number | null;
  category: Partial<Record<Category, number>>;
}

/** What a user sees until they set their own. Typical full-service numbers, not advice for any one business. */
export const DEFAULT_TARGETS: Targets = {
  food_cost_pct: 30,
  labor_pct: 30,
  prime_cost_pct: 60,
  margin_pct: 65,
  category: { meat: 11, produce: 4, dairy: 3, dry_goods: 7, beverage: 2, other: 2 },
};

export interface TargetsRow {
  food_cost_pct: number | string | null;
  labor_pct: number | string | null;
  prime_cost_pct: number | string | null;
  margin_pct: number | string | null;
  category_targets?: unknown;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** No saved row means defaults. A saved row is taken as written: a null field means the owner has not set that target. */
export function resolveTargets(row: TargetsRow | undefined): Targets {
  if (!row) return { ...DEFAULT_TARGETS, category: { ...DEFAULT_TARGETS.category } };
  const category: Partial<Record<Category, number>> = {};
  const raw = row.category_targets;
  if (typeof raw === "object" && raw !== null) {
    for (const c of CATEGORIES) {
      const n = num((raw as Record<string, number | string | null>)[c]);
      if (n !== null) category[c] = n;
    }
  }
  return {
    food_cost_pct: num(row.food_cost_pct),
    labor_pct: num(row.labor_pct),
    prime_cost_pct: num(row.prime_cost_pct),
    margin_pct: num(row.margin_pct),
    category,
  };
}
