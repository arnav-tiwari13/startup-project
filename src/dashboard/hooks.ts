import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { TableResponse } from "../../supabase/functions/_shared/tables/types.ts";
import { ApiError, fetchTable, supabaseViewsRepo, type TableRequestInput } from "./api";
import { ViewsController } from "./controller";

/** The dashboard's saved-views controller as React state. Pending edits are saved when the tab hides or the page unmounts. */
export function useDashboard() {
  const controller = useMemo(() => new ViewsController(supabaseViewsRepo), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    void controller.load();
    const onHide = () => void controller.flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void controller.flush();
    };
  }, [controller]);
  return { controller, state };
}

export interface TableState {
  /** The last successful response. Kept while the next one loads, so the table does not flash empty. */
  data: TableResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads one table. Re-runs when the request changes or `refreshKey` is bumped, and cancels stale requests. */
export function useTable(request: TableRequestInput, refreshKey: number): TableState {
  const [data, setData] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchTable(JSON.parse(key) as TableRequestInput, controller.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof ApiError ? err.message : "Something went wrong loading this table. Please try again.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [key, refreshKey, retry]);

  const reload = useCallback(() => setRetry((n) => n + 1), []);
  return { data, loading, error, reload };
}

/** Delays a fast-changing value (like a search box) before it is used. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
