import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_VIEW_NAME, ViewsController, type SavedView, type ViewsRepo } from "../../src/dashboard/controller.ts";
import { defaultView, moveTable, setColumnVisible, setComparison, MAX_SAVED_VIEWS } from "../../supabase/functions/_shared/tables/view.ts";

/** An in-memory stand-in for the dashboard_views table, with the same one-active-view rule. */
function memoryRepo(seed: SavedView[] = []) {
  const rows = new Map(seed.map((v) => [v.id, { ...v }]));
  let n = 0;
  const calls: string[] = [];
  const repo: ViewsRepo & { rows: typeof rows; calls: string[]; failNext: () => void } = {
    rows, calls,
    failNext: () => { fail = true; },
    async list() { calls.push("list"); return [...rows.values()]; },
    async create(name, config, active) {
      check(); calls.push(`create:${name}`);
      if (active) for (const r of rows.values()) r.is_active = false;
      const v = { id: `v${++n}`, name, config: JSON.parse(JSON.stringify(config)), is_active: active };
      rows.set(v.id, v);
      return { ...v };
    },
    async saveConfig(id, config) { check(); calls.push(`save:${id}`); rows.get(id)!.config = JSON.parse(JSON.stringify(config)); },
    async rename(id, name) { check(); rows.get(id)!.name = name; },
    async remove(id) { check(); rows.delete(id); },
    async activate(id) { check(); for (const r of rows.values()) r.is_active = r.id === id; },
  };
  let fail = false;
  const check = () => { if (fail) { fail = false; throw new Error("boom"); } };
  return repo;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("loading", () => {
  it("a new user gets the default layout and nothing is written until they change something", async () => {
    const repo = memoryRepo();
    const c = new ViewsController(repo);
    await c.load();
    expect(c.getState()).toMatchObject({ status: "ready", activeId: null, config: defaultView() });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(repo.rows.size).toBe(0);
  });

  it("loads the active saved view, and survives a corrupt stored config", async () => {
    const good = { ...defaultView(), comparison: "target" as const };
    const repo = memoryRepo([{ id: "a", name: "A", config: { nonsense: true }, is_active: false }, { id: "b", name: "B", config: good, is_active: true }]);
    const c = new ViewsController(repo);
    await c.load();
    expect(c.getState().activeId).toBe("b");
    expect(c.getState().config.comparison).toBe("target");
    await c.switchTo("a");
    expect(c.getState().config).toEqual(defaultView());
  });

  it("reports a load failure without crashing", async () => {
    const repo = memoryRepo();
    repo.list = async () => { throw new Error("db down"); };
    const c = new ViewsController(repo);
    await c.load();
    expect(c.getState()).toMatchObject({ status: "error", message: expect.stringContaining("Couldn't load") });
  });
});

describe("saving layout changes", () => {
  it("the first edit creates 'My dashboard' as the active view, with the edit saved in it", async () => {
    const repo = memoryRepo();
    const c = new ViewsController(repo);
    await c.load();
    c.update((v) => moveTable(v, "menu_margins", -1));
    expect(c.getState().save).toBe("saving");
    await vi.advanceTimersByTimeAsync(700);
    expect(c.getState().save).toBe("saved");
    const [row] = [...repo.rows.values()];
    expect(row).toMatchObject({ name: FIRST_VIEW_NAME, is_active: true });
    expect((row.config as ReturnType<typeof defaultView>).tables[2].id).toBe("menu_margins"); // moved up from fourth to third
  });

  it("a burst of edits is saved once, with the final state", async () => {
    const repo = memoryRepo([{ id: "a", name: "A", config: defaultView(), is_active: true }]);
    const c = new ViewsController(repo);
    await c.load();
    c.update((v) => setComparison(v, "target"));
    c.update((v) => setColumnVisible(v, "menu_margins", "price", false));
    c.update((v) => setComparison(v, "same_period_last_year"));
    await vi.advanceTimersByTimeAsync(700);
    expect(repo.calls.filter((x) => x.startsWith("save:"))).toHaveLength(1);
    const saved = repo.rows.get("a")!.config as ReturnType<typeof defaultView>;
    expect(saved.comparison).toBe("same_period_last_year");
    expect(saved.tables.find((t) => t.id === "menu_margins")!.columns.find((x) => x.id === "price")!.visible).toBe(false);
  });

  it("a layout saved by one controller loads in another", async () => {
    const repo = memoryRepo();
    const first = new ViewsController(repo);
    await first.load();
    first.update((v) => moveTable(v, "usage_variance", -1));
    await first.flush();
    const second = new ViewsController(repo);
    await second.load();
    expect(second.getState().config).toEqual(first.getState().config);
  });

  it("flush saves immediately (leaving the page), and keeps the edit on screen when saving fails", async () => {
    const repo = memoryRepo([{ id: "a", name: "A", config: defaultView(), is_active: true }]);
    const c = new ViewsController(repo);
    await c.load();
    c.update((v) => setComparison(v, "target"));
    repo.failNext();
    await c.flush();
    expect(c.getState()).toMatchObject({ save: "error", message: expect.stringContaining("still on screen") });
    expect(c.getState().config.comparison).toBe("target");
    c.update((v) => v); // the next edit retries
    await vi.advanceTimersByTimeAsync(700);
    expect(c.getState().save).toBe("saved");
    expect((repo.rows.get("a")!.config as ReturnType<typeof defaultView>).comparison).toBe("target");
  });

  it("an edit made while a save is in flight is saved too", async () => {
    const repo = memoryRepo([{ id: "a", name: "A", config: defaultView(), is_active: true }]);
    const original = repo.saveConfig;
    let release!: () => void;
    repo.saveConfig = async (id, cfg) => { await new Promise<void>((r) => (release = r)); return original(id, cfg); };
    const c = new ViewsController(repo, 0);
    await c.load();
    c.update((v) => setComparison(v, "target"));
    await vi.advanceTimersByTimeAsync(0);
    c.update((v) => setComparison(v, "same_period_last_year"));
    repo.saveConfig = original;
    release();
    await c.flush();
    await vi.advanceTimersByTimeAsync(10);
    await c.flush();
    expect((repo.rows.get("a")!.config as ReturnType<typeof defaultView>).comparison).toBe("same_period_last_year");
  });
});

describe("named views", () => {
  const withOne = () => memoryRepo([{ id: "a", name: "Weekly", config: defaultView(), is_active: true }]);

  it("save as copies the current layout into a new active view and leaves the old one as it was", async () => {
    const repo = withOne();
    const c = new ViewsController(repo);
    await c.load();
    c.update((v) => setComparison(v, "target"));
    expect(await c.saveAs("  Monday ordering ")).toBeNull();
    const rows = [...repo.rows.values()];
    expect(rows.filter((r) => r.is_active).map((r) => r.name)).toEqual(["Monday ordering"]);
    expect((repo.rows.get("a")!.config as ReturnType<typeof defaultView>).comparison).toBe("target"); // pending edit saved first
    expect(c.getState().activeId).not.toBe("a");
  });

  it("rejects empty, duplicate and over-limit names without writing", async () => {
    const repo = withOne();
    const c = new ViewsController(repo);
    await c.load();
    expect(await c.saveAs("   ")).toMatch(/name/i);
    expect(await c.saveAs("weekly")).toMatch(/already/i);
    expect(repo.rows.size).toBe(1);
    const full = memoryRepo(Array.from({ length: MAX_SAVED_VIEWS }, (_, i) => ({ id: `v${i}`, name: `V${i}`, config: defaultView(), is_active: i === 0 })));
    const c2 = new ViewsController(full);
    await c2.load();
    expect(await c2.saveAs("One more")).toMatch(String(MAX_SAVED_VIEWS));
  });

  it("switching views loads that view's layout and makes it the only active one", async () => {
    const other = { ...defaultView(), comparison: "target" as const };
    const repo = memoryRepo([{ id: "a", name: "A", config: defaultView(), is_active: true }, { id: "b", name: "B", config: other, is_active: false }]);
    const c = new ViewsController(repo);
    await c.load();
    await c.switchTo("b");
    expect(c.getState().config.comparison).toBe("target");
    expect([...repo.rows.values()].filter((r) => r.is_active).map((r) => r.id)).toEqual(["b"]);
  });

  it("renames, and refuses a name another view already uses", async () => {
    const repo = memoryRepo([{ id: "a", name: "A", config: defaultView(), is_active: true }, { id: "b", name: "B", config: defaultView(), is_active: false }]);
    const c = new ViewsController(repo);
    await c.load();
    expect(await c.rename("b", "Closing")).toBeNull();
    expect(repo.rows.get("b")!.name).toBe("Closing");
    expect(await c.rename("b", "a")).toMatch(/already/i);
  });

  it("deleting the active view falls back to another, and deleting the last one returns to the default layout", async () => {
    const repo = memoryRepo([{ id: "a", name: "A", config: defaultView(), is_active: true }, { id: "b", name: "B", config: { ...defaultView(), comparison: "target" }, is_active: false }]);
    const c = new ViewsController(repo);
    await c.load();
    await c.remove("a");
    expect(c.getState()).toMatchObject({ activeId: "b" });
    expect(c.getState().config.comparison).toBe("target");
    await c.remove("b");
    expect(c.getState()).toMatchObject({ activeId: null, config: defaultView() });
    expect(repo.rows.size).toBe(0);
  });

  it("reset puts the current view back to the default and saves it", async () => {
    const repo = memoryRepo([{ id: "a", name: "A", config: { ...defaultView(), comparison: "target" }, is_active: true }]);
    const c = new ViewsController(repo);
    await c.load();
    c.reset();
    await vi.advanceTimersByTimeAsync(700);
    expect(repo.rows.get("a")!.config).toEqual(defaultView());
  });
});
