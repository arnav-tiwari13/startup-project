import { useState, type FormEvent } from "react";
import { MAX_RANGE_DAYS, daysInRange, isIsoDate, type PeriodPreset } from "../../supabase/functions/_shared/metrics/index.ts";
import type { ViewConfig } from "../../supabase/functions/_shared/tables/view.ts";
import type { DashboardState, ViewsController } from "./controller";
import Modal from "./Modal";

const PERIODS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom range" },
];
const COMPARISONS: { value: ViewConfig["comparison"]; label: string }[] = [
  { value: "previous_period", label: "Previous period" },
  { value: "same_period_last_year", label: "Same period last year" },
  { value: "target", label: "My targets" },
];

const field = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:border-accent";
const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50";

function NameForm({ title, initial, action, onDone }: { title: string; initial: string; action: string; onDone: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await onDone(name));
    setBusy(false);
  };
  return (
    <form onSubmit={submit} aria-label={title}>
      <label className="block text-sm font-medium">
        View name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={`${field} mt-1 w-full`} placeholder="e.g. Monday ordering" />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">{busy ? "Saving…" : action}</button>
      </div>
    </form>
  );
}

export default function Toolbar({ state, controller, onCustomize, onTargets }: {
  state: DashboardState;
  controller: ViewsController;
  onCustomize: () => void;
  onTargets: () => void;
}) {
  const { config, views, activeId } = state;
  const [dialog, setDialog] = useState<null | "saveAs" | "rename" | "delete">(null);
  const active = views.find((v) => v.id === activeId);
  const close = () => setDialog(null);

  // Custom ranges are checked before they are applied, so a half-typed or impossible range never reaches the saved view.
  const [custom, setCustom] = useState({ start: config.period.start ?? "", end: config.period.end ?? "" });
  const customError =
    config.period.preset !== "custom" ? null
    : !isIsoDate(custom.start) || !isIsoDate(custom.end) ? "Pick a start and end date."
    : custom.start > custom.end ? "The end date is before the start date."
    : daysInRange({ start: custom.start, end: custom.end }) > MAX_RANGE_DAYS ? "Ranges can be up to one year."
    : null;
  const applyCustom = (next: { start: string; end: string }) => {
    setCustom(next);
    if (isIsoDate(next.start) && isIsoDate(next.end) && next.start <= next.end && daysInRange(next) <= MAX_RANGE_DAYS) {
      controller.update((c) => ({ ...c, period: { preset: "custom", start: next.start, end: next.end } }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="text-xs font-medium text-muted">
          View
          <select
            value={activeId ?? ""}
            onChange={(e) => void controller.switchTo(e.target.value)}
            className={`${field} mt-1 block min-w-44`}
            aria-label="Saved view"
          >
            {views.length === 0 && <option value="">Default layout</option>}
            {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Period
          <select
            value={config.period.preset}
            onChange={(e) => {
              const preset = e.target.value as PeriodPreset;
              if (preset === "custom") {
                const t = new Date().toISOString().slice(0, 10);
                const next = isIsoDate(custom.start) && isIsoDate(custom.end) ? custom : { start: t, end: t };
                setCustom(next);
                controller.update((c) => ({ ...c, period: { preset, start: next.start, end: next.end } }));
              } else controller.update((c) => ({ ...c, period: { preset } }));
            }}
            className={`${field} mt-1 block`}
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>

        {config.period.preset === "custom" && (
          <>
            <label className="text-xs font-medium text-muted">
              From
              <input type="date" value={custom.start} onChange={(e) => applyCustom({ ...custom, start: e.target.value })} className={`${field} mt-1 block`} />
            </label>
            <label className="text-xs font-medium text-muted">
              To
              <input type="date" value={custom.end} onChange={(e) => applyCustom({ ...custom, end: e.target.value })} className={`${field} mt-1 block`} />
            </label>
          </>
        )}

        <label className="text-xs font-medium text-muted">
          Compare with
          <select value={config.comparison} onChange={(e) => controller.update((c) => ({ ...c, comparison: e.target.value as ViewConfig["comparison"] }))} className={`${field} mt-1 block`}>
            {COMPARISONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onCustomize} className={button}>Customize tables</button>
          <button type="button" onClick={onTargets} className={button}>Targets</button>
          <details className="relative">
            <summary className={`${button} cursor-pointer list-none`} aria-label="View options">{"⋯"}</summary>
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-surface p-1 shadow-card">
              {([
                ["saveAs", "Save as new view…", false],
                ["rename", "Rename this view…", !active],
                ["delete", "Delete this view…", !active],
              ] as const).map(([id, label, disabled]) => (
                <button key={id} type="button" disabled={disabled} onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; setDialog(id); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg disabled:opacity-40">{label}</button>
              ))}
              <button type="button" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; controller.reset(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg">Reset layout</button>
            </div>
          </details>
        </div>
      </div>

      <div className="min-h-5 text-xs" aria-live="polite">
        {customError && <span className="text-bad">{customError} </span>}
        {state.message ? <span role="alert" className="text-bad">{state.message}</span>
          : state.save === "saving" ? <span className="text-muted">Saving{"…"}</span>
          : state.save === "saved" ? <span className="text-muted">Saved to {active?.name ?? "your dashboard"}</span>
          : null}
      </div>

      {dialog === "saveAs" && (
        <Modal title="Save as new view" onClose={close}>
          <NameForm title="Save view" initial="" action="Save view" onDone={async (n) => { const err = await controller.saveAs(n); if (!err) close(); return err; }} />
        </Modal>
      )}
      {dialog === "rename" && active && (
        <Modal title="Rename view" onClose={close}>
          <NameForm title="Rename view" initial={active.name} action="Rename" onDone={async (n) => { const err = await controller.rename(active.id, n); if (!err) close(); return err; }} />
        </Modal>
      )}
      {dialog === "delete" && active && (
        <Modal title="Delete view" onClose={close}>
          <p className="text-sm">Delete <strong>{active.name}</strong>? Your other views are not affected. This can't be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={close} className={button}>Cancel</button>
            <button type="button" onClick={async () => { await controller.remove(active.id); close(); }} className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-bg">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
