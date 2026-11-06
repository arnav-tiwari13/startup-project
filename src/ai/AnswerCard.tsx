import { useState } from "react";
import type { Answer } from "../../supabase/functions/_shared/advisor/answer.ts";
import { saveAction } from "./actions";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const EFFORT = { low: "Low effort", medium: "Medium effort", high: "High effort" } as const;

type SaveState = "idle" | "saving" | "saved" | "error";

/** The structured answer: summary, evidence, actions with dollar impact / effort / risk, and anything missing. */
export default function AnswerCard({ answer, widgetId }: { answer: Answer; widgetId: string }) {
  const [saved, setSaved] = useState<Record<number, SaveState>>({});
  const save = async (i: number) => {
    setSaved((s) => ({ ...s, [i]: "saving" }));
    try {
      await saveAction(widgetId, answer.actions[i]);
      setSaved((s) => ({ ...s, [i]: "saved" }));
    } catch {
      setSaved((s) => ({ ...s, [i]: "error" }));
    }
  };
  const empty = answer.evidence.length === 0 && answer.actions.length === 0;

  return (
    <div className="space-y-4 rounded-2xl rounded-bl-sm border border-line bg-bg px-3.5 py-3 text-sm">
      <p className="text-base font-semibold leading-snug">{answer.summary}</p>

      {answer.evidence.length > 0 && (
        <section aria-label="Evidence">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Evidence</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">{answer.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </section>
      )}

      {answer.actions.length > 0 && (
        <section aria-label="Recommended actions" className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recommended actions</h3>
          {answer.actions.map((a, i) => {
            const state = saved[i] ?? "idle";
            return (
              <div key={i} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{a.title}</p>
                  <span className="rounded-full bg-good-bg px-2.5 py-0.5 text-xs font-semibold text-good">
                    {a.impact_dollars === null ? "Impact not estimated" : `About ${usd.format(a.impact_dollars)}/month`}
                  </span>
                </div>
                <p className="mt-1">{a.detail}</p>
                {a.impact_basis && <p className="mt-1 text-xs text-muted">Basis: {a.impact_basis}</p>}
                <p className="mt-2 text-xs"><span className="font-semibold">{EFFORT[a.effort]}</span> · <span className="font-semibold">Risk:</span> {a.risk}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button" onClick={() => void save(i)} disabled={state === "saving" || state === "saved"}
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    {state === "saved" ? "Saved ✓" : state === "saving" ? "Saving…" : "Save to action list"}
                  </button>
                  {state === "error" && <span role="alert" className="text-xs text-bad">Couldn't save. Try again.</span>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {answer.missing_data.length > 0 && (
        <section aria-label="Missing data" className="rounded-xl border border-watch/40 bg-watch-bg px-3 py-2 text-watch">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider">Missing data</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{answer.missing_data.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </section>
      )}
      {empty && answer.missing_data.length === 0 && <p className="text-muted">Nothing further to recommend from this data.</p>}
    </div>
  );
}
