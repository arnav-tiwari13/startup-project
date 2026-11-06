import { useCallback, useEffect, useState } from "react";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import type { TableId } from "../../supabase/functions/_shared/tables/types.ts";
import Modal from "../dashboard/Modal";
import { deleteAction, listActions, setActionStatus, type ActionItem, type ActionStatus } from "./actions";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const small = "rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:text-accent";

/** The owner's saved recommendations, with a status they can change. */
export default function ActionList({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    listActions().then(setItems).catch(() => setError("Couldn't load your action list."));
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<void>) => {
    try { await fn(); load(); } catch { setError("That didn't work. Please try again."); }
  };
  const open = items?.filter((i) => i.status === "open") ?? [];
  const closed = items?.filter((i) => i.status !== "open") ?? [];
  const row = (i: ActionItem) => (
    <li key={i.id} className="rounded-xl border border-line bg-bg p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`font-semibold ${i.status !== "open" ? "text-muted line-through" : ""}`}>{i.title}</p>
        <span className="text-xs font-semibold text-good">{i.impact_cents === null ? "Impact not estimated" : `About ${usd.format(i.impact_cents / 100)}/month`}</span>
      </div>
      <p className="mt-1">{i.detail}</p>
      <p className="mt-1 text-xs text-muted">{i.effort} effort · Risk: {i.risk} · From {TABLE_DEFS[i.widget_id as TableId]?.title ?? "AI mode"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {i.status === "open" ? (
          <>
            <button type="button" className={small} onClick={() => void act(() => setActionStatus(i.id, "done"))}>Mark done</button>
            <button type="button" className={small} onClick={() => void act(() => setActionStatus(i.id, "dismissed"))}>Dismiss</button>
          </>
        ) : (
          <button type="button" className={small} onClick={() => void act(() => setActionStatus(i.id, "open" as ActionStatus))}>Reopen</button>
        )}
        <button type="button" className={small} onClick={() => void act(() => deleteAction(i.id))}>Delete</button>
      </div>
    </li>
  );

  return (
    <Modal title="Action list" onClose={onClose}>
      {error && <p role="alert" className="mb-3 rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error} <button type="button" onClick={load} className="font-semibold underline">Try again</button></p>}
      {items === null && !error && <div role="status" aria-label="Loading action list" className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-line/60" />)}</div>}
      {items?.length === 0 && <p className="text-sm text-muted">Nothing saved yet. Turn on AI mode, click something on the dashboard, and save a recommendation here.</p>}
      {open.length > 0 && <ul className="space-y-2">{open.map(row)}</ul>}
      {closed.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted">Done and dismissed ({closed.length})</summary>
          <ul className="mt-2 space-y-2">{closed.map(row)}</ul>
        </details>
      )}
    </Modal>
  );
}
