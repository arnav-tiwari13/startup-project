import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import { defaultView, moveTable, setTableVisible, type ViewConfig } from "../../supabase/functions/_shared/tables/view.ts";
import Modal from "./Modal";

/** Choose which tables appear, and in what order. */
export default function CustomizePanel({ config, onChange, onClose }: {
  config: ViewConfig;
  onChange: (fn: (c: ViewConfig) => ViewConfig) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Customize tables" onClose={onClose}>
      <p className="text-sm text-muted">Show the tables you use and hide the rest. Use the arrows to change the order. Changes save automatically.</p>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {config.tables.map((t, i) => {
          const def = TABLE_DEFS[t.id];
          return (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <label className="flex min-w-0 flex-1 items-start gap-3">
                <input type="checkbox" checked={t.visible} onChange={(e) => onChange((c) => setTableVisible(c, t.id, e.target.checked))} className="mt-1 accent-[var(--accent)]" />
                <span className="min-w-0">
                  <span className="block font-medium">{def.title}</span>
                  <span className="block text-xs text-muted">{def.description}</span>
                </span>
              </label>
              <button type="button" aria-label={`Move ${def.title} up`} disabled={i === 0} onClick={() => onChange((c) => moveTable(c, t.id, -1))} className="h-8 w-8 rounded-lg border border-line text-muted hover:border-accent hover:text-accent disabled:opacity-30">{"↑"}</button>
              <button type="button" aria-label={`Move ${def.title} down`} disabled={i === config.tables.length - 1} onClick={() => onChange((c) => moveTable(c, t.id, 1))} className="h-8 w-8 rounded-lg border border-line text-muted hover:border-accent hover:text-accent disabled:opacity-30">{"↓"}</button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-between">
        <button type="button" onClick={() => onChange(() => defaultView())} className="text-sm font-medium text-accent hover:underline">Reset to the default layout</button>
        <button type="button" onClick={onClose} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg">Done</button>
      </div>
    </Modal>
  );
}
