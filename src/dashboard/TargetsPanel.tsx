import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_TARGETS, resolveTargets } from "../../supabase/functions/_shared/tables/targets.ts";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "../../supabase/functions/_shared/tables/types.ts";
import { targetsInputSchema, type TargetsInput } from "../../supabase/functions/_shared/tables/view.ts";
import { loadTargets, saveTargets } from "./api";
import Modal from "./Modal";

const field = "w-24 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-right text-sm tabular-nums text-ink focus-visible:border-accent";

type Draft = Record<string, string>; // text boxes: blank means "not set"
const MAIN = [
  { id: "food_cost_pct", label: "Food cost", hint: "Food cost as a share of sales. Lower is better." },
  { id: "labor_pct", label: "Labor", hint: "Labor cost as a share of sales. Lower is better." },
  { id: "prime_cost_pct", label: "Prime cost", hint: "Food plus labor as a share of sales. Lower is better." },
  { id: "margin_pct", label: "Menu margin", hint: "Margin on each dish. Higher is better." },
] as const;

const show = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** Where the owner sets the numbers their tables are colored against. */
export default function TargetsPanel({ restaurants, onSaved, onClose }: {
  restaurants: { id: string; name: string }[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [usingDefaults, setUsingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let live = true;
    setDraft(null);
    setError(null);
    loadTargets(restaurantId)
      .then((row) => {
        if (!live) return;
        const t = resolveTargets(row ?? undefined);
        setUsingDefaults(row === null);
        setDraft({
          food_cost_pct: show(t.food_cost_pct), labor_pct: show(t.labor_pct), prime_cost_pct: show(t.prime_cost_pct), margin_pct: show(t.margin_pct),
          ...Object.fromEntries(CATEGORIES.map((c) => [`cat_${c}`, show(t.category[c])])),
        });
      })
      .catch(() => live && setError("Couldn't load your targets. Please try again."));
    return () => { live = false; };
  }, [restaurantId]);

  const parse = (s: string): number | null | undefined => {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const bad = [...MAIN.map((m) => m.id), ...CATEGORIES.map((c) => `cat_${c}`)].find((k) => parse(draft[k]) === undefined);
    if (bad) return setError("Targets must be numbers from 0 to 100, or blank.");
    const input: TargetsInput = {
      food_cost_pct: parse(draft.food_cost_pct) ?? null,
      labor_pct: parse(draft.labor_pct) ?? null,
      prime_cost_pct: parse(draft.prime_cost_pct) ?? null,
      margin_pct: parse(draft.margin_pct) ?? null,
      category_targets: Object.fromEntries(CATEGORIES.flatMap((c) => { const v = parse(draft[`cat_${c}`]); return v === null || v === undefined ? [] : [[c, v]]; })),
    };
    const checked = targetsInputSchema.safeParse(input);
    if (!checked.success) return setError(checked.error.issues[0].message);
    setBusy(true);
    setError(null);
    try {
      await saveTargets(restaurantId, checked.data);
      onSaved();
      onClose();
    } catch {
      setError("Couldn't save your targets. Please try again.");
      setBusy(false);
    }
  };

  const input = (key: string, label: string, hint?: string) => (
    <label key={key} className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 text-sm">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="flex items-center gap-1.5">
        <input
          inputMode="decimal" value={draft?.[key] ?? ""} placeholder="Not set" aria-label={`${label} target, percent`}
          onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))} className={field}
        />
        <span className="text-sm text-muted">%</span>
      </span>
    </label>
  );

  return (
    <Modal title="Your targets" onClose={onClose}>
      {restaurants.length === 0 ? (
        <p className="text-sm text-muted">No restaurant is linked to your account yet.</p>
      ) : (
        <form onSubmit={submit}>
          <p className="text-sm text-muted">
            Tables color a number green, yellow or red against these. Leave a box blank if you don't want a target for it.
            {usingDefaults && " Until you save, platecfo uses typical starting numbers."}
          </p>
          {restaurants.length > 1 && (
            <label className="mt-3 block text-sm font-medium">
              Location
              <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
          {!draft && !error && <p className="mt-4 text-sm text-muted" role="status">Loading{"…"}</p>}
          {draft && (
            <>
              <fieldset className="mt-3">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Overall</legend>
                <div className="divide-y divide-line">{MAIN.map((m) => input(m.id, m.label, m.hint))}</div>
              </fieldset>
              <fieldset className="mt-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Food cost by category (% of sales)</legend>
                <div className="divide-y divide-line">{CATEGORIES.map((c: Category) => input(`cat_${c}`, CATEGORY_LABELS[c]))}</div>
              </fieldset>
            </>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
          <div className="mt-5 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => draft && setDraft({
                food_cost_pct: show(DEFAULT_TARGETS.food_cost_pct), labor_pct: show(DEFAULT_TARGETS.labor_pct), prime_cost_pct: show(DEFAULT_TARGETS.prime_cost_pct), margin_pct: show(DEFAULT_TARGETS.margin_pct),
                ...Object.fromEntries(CATEGORIES.map((c) => [`cat_${c}`, show(DEFAULT_TARGETS.category[c])])),
              })}
              className="text-sm font-medium text-accent hover:underline"
            >
              Use typical numbers
            </button>
            <button type="submit" disabled={!draft || busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">{busy ? "Saving…" : "Save targets"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
