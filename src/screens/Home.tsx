// Overview: customizable tables. Each table, its columns, sort, filters, grouping, the period and the
// comparison are saved per user as a named view (see src/dashboard/controller.ts).
import { useEffect, useState } from "react";
import { TABLE_DEFS } from "../../supabase/functions/_shared/tables/definitions.ts";
import { setTableVisible } from "../../supabase/functions/_shared/tables/view.ts";
import { listRestaurants } from "../dashboard/api";
import CustomizePanel from "../dashboard/CustomizePanel";
import { useDashboard } from "../dashboard/hooks";
import TableCard from "../dashboard/TableCard";
import TargetsPanel from "../dashboard/TargetsPanel";
import Toolbar from "../dashboard/Toolbar";

export default function Home() {
  const { controller, state } = useDashboard();
  const [panel, setPanel] = useState<null | "customize" | "targets">(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    listRestaurants().then(setRestaurants).catch(() => setRestaurants([]));
  }, []);

  if (state.status === "loading") {
    return <p role="status" className="text-sm text-muted">Loading your dashboard{"…"}</p>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-xl border border-bad/40 bg-bad-bg px-4 py-3 text-sm text-bad">
        {state.message}{" "}
        <button type="button" onClick={() => void controller.load()} className="ml-2 rounded-lg border border-bad/40 px-3 py-1 font-medium hover:bg-bad/10">Try again</button>
      </div>
    );
  }
  if (restaurants !== null && restaurants.length === 0) {
    return (
      <section className="max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">No restaurant linked yet</h2>
        <p className="mt-2 text-sm text-muted">Your account isn't connected to a restaurant, so there is nothing to show. Once one is linked, your tables appear here.</p>
      </section>
    );
  }

  const { config } = state;
  const visible = config.tables.filter((t) => t.visible);
  const hidden = config.tables.filter((t) => !t.visible);

  return (
    <div className="space-y-6">
      <Toolbar state={state} controller={controller} onCustomize={() => setPanel("customize")} onTargets={() => setPanel("targets")} />

      {hidden.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Hidden:
          {hidden.map((t) => (
            <button
              key={t.id} type="button" onClick={() => controller.update((c) => setTableVisible(c, t.id, true))}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:border-accent hover:text-accent"
              aria-label={`Show ${TABLE_DEFS[t.id].title}`}
            >
              + {TABLE_DEFS[t.id].title}
            </button>
          ))}
        </p>
      )}

      {visible.length === 0 && (
        <section className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted shadow-card">
          Every table is hidden. Use <strong className="text-ink">Customize tables</strong> to bring some back.
        </section>
      )}

      {visible.map((t) => (
        <TableCard key={t.id} view={t} config={config} refreshKey={refreshKey} onChange={(fn) => controller.update(fn)} />
      ))}

      {panel === "customize" && <CustomizePanel config={config} onChange={(fn) => controller.update(fn)} onClose={() => setPanel(null)} />}
      {panel === "targets" && <TargetsPanel restaurants={restaurants ?? []} onSaved={() => setRefreshKey((k) => k + 1)} onClose={() => setPanel(null)} />}
    </div>
  );
}
