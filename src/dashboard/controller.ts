// Owns the dashboard's saved views: loading, autosaving edits, "save as", switching, renaming, deleting.
// No React and no Supabase in here: it talks to a ViewsRepo, so it is tested with an in-memory one.
import {
  MAX_SAVED_VIEWS, defaultView, loadViewConfig, viewNameSchema, type ViewConfig,
} from "../../supabase/functions/_shared/tables/view.ts";

export interface SavedView { id: string; name: string; config: unknown; is_active: boolean }

export interface ViewsRepo {
  list(): Promise<SavedView[]>;
  create(name: string, config: ViewConfig, active: boolean): Promise<SavedView>;
  saveConfig(id: string, config: ViewConfig): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** Makes one view the active one and every other view inactive. */
  activate(id: string): Promise<void>;
}

export type SaveState = "idle" | "saving" | "saved" | "error";
export interface DashboardState {
  status: "loading" | "ready" | "error";
  views: SavedView[];
  /** null until the user's first edit: new users run on the default layout without a database row. */
  activeId: string | null;
  config: ViewConfig;
  save: SaveState;
  /** A short message safe to show, set when the last action failed. */
  message: string | null;
}

export const FIRST_VIEW_NAME = "My dashboard";

export class ViewsController {
  private state: DashboardState = { status: "loading", views: [], activeId: null, config: defaultView(), save: "idle", message: null };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private running: Promise<void> | null = null;

  constructor(private repo: ViewsRepo, private debounceMs = 700) {}

  getState = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<DashboardState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  async load() {
    try {
      const views = await this.repo.list();
      const active = views.find((v) => v.is_active) ?? views[0];
      this.set({ status: "ready", views, activeId: active?.id ?? null, config: active ? loadViewConfig(active.config) : defaultView(), message: null });
    } catch {
      this.set({ status: "error", message: "Couldn't load your saved views." });
    }
  }

  /** Applies an edit to the current layout and saves it shortly after the user stops changing things. */
  update(fn: (c: ViewConfig) => ViewConfig) {
    this.set({ config: fn(this.state.config), save: "saving", message: null });
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  /** Saves any pending edit now (also called when leaving the page). */
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) await this.running;
    if (!this.dirty) return;
    this.running = this.persist().finally(() => (this.running = null));
    await this.running;
  }

  private async persist() {
    while (this.dirty) {
      this.dirty = false;
      const { activeId, config } = this.state;
      try {
        if (activeId === null) {
          const created = await this.repo.create(FIRST_VIEW_NAME, config, true);
          this.set({ views: [...this.state.views, created], activeId: created.id });
        } else {
          await this.repo.saveConfig(activeId, config);
          this.set({ views: this.state.views.map((v) => (v.id === activeId ? { ...v, config } : v)) });
        }
        if (!this.dirty) this.set({ save: "saved" });
      } catch {
        this.set({ save: "error", message: "Couldn't save your changes. They are still on screen." });
        return;
      }
    }
  }

  /** Saves the current layout as a new named view and switches to it. Returns an error message, or null on success. */
  async saveAs(name: string): Promise<string | null> {
    const parsed = viewNameSchema.safeParse(name);
    if (!parsed.success) return parsed.error.issues[0].message;
    if (this.state.views.length >= MAX_SAVED_VIEWS) return `You can keep up to ${MAX_SAVED_VIEWS} views. Delete one first.`;
    if (this.state.views.some((v) => v.name.toLowerCase() === parsed.data.toLowerCase())) return "You already have a view with that name.";
    await this.flush();
    try {
      const created = await this.repo.create(parsed.data, this.state.config, true);
      await this.repo.activate(created.id);
      this.set({ views: [...this.state.views.map((v) => ({ ...v, is_active: false })), { ...created, is_active: true }], activeId: created.id, save: "saved", message: null });
      return null;
    } catch {
      return "Couldn't save the view. Please try again.";
    }
  }

  async switchTo(id: string) {
    const target = this.state.views.find((v) => v.id === id);
    if (!target || id === this.state.activeId) return;
    await this.flush();
    try {
      await this.repo.activate(id);
      this.set({
        views: this.state.views.map((v) => ({ ...v, is_active: v.id === id })),
        activeId: id, config: loadViewConfig(target.config), save: "idle", message: null,
      });
    } catch {
      this.set({ message: "Couldn't switch views. Please try again." });
    }
  }

  async rename(id: string, name: string): Promise<string | null> {
    const parsed = viewNameSchema.safeParse(name);
    if (!parsed.success) return parsed.error.issues[0].message;
    if (this.state.views.some((v) => v.id !== id && v.name.toLowerCase() === parsed.data.toLowerCase())) return "You already have a view with that name.";
    try {
      await this.repo.rename(id, parsed.data);
      this.set({ views: this.state.views.map((v) => (v.id === id ? { ...v, name: parsed.data } : v)) });
      return null;
    } catch {
      return "Couldn't rename the view. Please try again.";
    }
  }

  async remove(id: string) {
    await this.flush();
    try {
      await this.repo.remove(id);
      const views = this.state.views.filter((v) => v.id !== id);
      if (id !== this.state.activeId) return this.set({ views });
      const next = views[0];
      if (next) await this.repo.activate(next.id);
      this.set({
        views: views.map((v) => ({ ...v, is_active: v.id === next?.id })),
        activeId: next?.id ?? null, config: next ? loadViewConfig(next.config) : defaultView(), save: "idle", message: null,
      });
    } catch {
      this.set({ message: "Couldn't delete the view. Please try again." });
    }
  }

  /** Puts the current view back to the default layout (keeps its name). */
  reset() {
    this.update(() => defaultView());
  }
}
