// Talks to Supabase: the table-data function, saved views, targets and restaurants.
// Everything runs as the signed-in user, so row-level security limits it to their own data.
import type { z } from "zod";
import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase";
import type { tableRequestSchema } from "../../supabase/functions/_shared/tables/schema.ts";
import type { TableResponse } from "../../supabase/functions/_shared/tables/types.ts";
import { targetsInputSchema, type TargetsInput, type ViewConfig } from "../../supabase/functions/_shared/tables/view.ts";
import type { TargetsRow } from "../../supabase/functions/_shared/tables/targets.ts";
import type { SavedView, ViewsRepo } from "./controller";

export type TableRequestInput = z.input<typeof tableRequestSchema>;

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function session() {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) throw new ApiError("not_configured", "Sign-in isn't set up, so tables aren't available.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError("unauthorized", "Please sign in again.");
  return { db: supabase, token: data.session.access_token, userId: data.session.user.id, url: supabaseUrl, anon: supabaseAnonKey };
}

export async function fetchTable(request: TableRequestInput, signal?: AbortSignal): Promise<TableResponse> {
  const { token, url, anon } = await session();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/table-data`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("network", "Couldn't reach platecfo. Check your connection and try again.");
  }
  if (res.status === 401) throw new ApiError("unauthorized", "Your session expired. Please sign in again.");
  if (res.status === 404) throw new ApiError("unavailable", "Tables aren't available yet.");
  if (!res.ok) throw new ApiError("failed", "Something went wrong loading this table. Please try again.");
  return (await res.json()) as TableResponse;
}

// ---- Saved views -----------------------------------------------------------------------------

const VIEW_COLUMNS = "id, name, config, is_active";
const fail = (error: { message: string } | null) => {
  if (error) throw new Error("request failed");
};

export const supabaseViewsRepo: ViewsRepo = {
  async list() {
    const { db } = await session();
    const { data, error } = await db.from("dashboard_views").select(VIEW_COLUMNS).order("created_at", { ascending: true });
    fail(error);
    return (data ?? []) as SavedView[];
  },
  async create(name, config, active) {
    const { db, userId } = await session();
    if (active) fail((await db.from("dashboard_views").update({ is_active: false }).eq("user_id", userId).eq("is_active", true)).error);
    const { data, error } = await db.from("dashboard_views").insert({ user_id: userId, name, config, is_active: active }).select(VIEW_COLUMNS).single();
    fail(error);
    return data as SavedView;
  },
  async saveConfig(id: string, config: ViewConfig) {
    const { db } = await session();
    fail((await db.from("dashboard_views").update({ config, updated_at: new Date().toISOString() }).eq("id", id)).error);
  },
  async rename(id, name) {
    const { db } = await session();
    fail((await db.from("dashboard_views").update({ name, updated_at: new Date().toISOString() }).eq("id", id)).error);
  },
  async remove(id) {
    const { db } = await session();
    fail((await db.from("dashboard_views").delete().eq("id", id)).error);
  },
  async activate(id) {
    const { db, userId } = await session();
    // The database allows one active view per user, so turn the old one off first.
    fail((await db.from("dashboard_views").update({ is_active: false }).eq("user_id", userId).eq("is_active", true).neq("id", id)).error);
    fail((await db.from("dashboard_views").update({ is_active: true }).eq("id", id)).error);
  },
};

// ---- Restaurants and targets -----------------------------------------------------------------

export async function listRestaurants(): Promise<{ id: string; name: string }[]> {
  const { db } = await session();
  const { data, error } = await db.from("restaurants").select("id, name").order("name");
  fail(error);
  return data ?? [];
}

export async function loadTargets(restaurantId: string): Promise<TargetsRow | null> {
  const { db, userId } = await session();
  const { data, error } = await db
    .from("user_targets")
    .select("food_cost_pct, labor_pct, prime_cost_pct, margin_pct, category_targets")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  fail(error);
  return (data as TargetsRow | null) ?? null;
}

export async function saveTargets(restaurantId: string, input: TargetsInput): Promise<void> {
  const parsed = targetsInputSchema.parse(input); // never send unvalidated values
  const { db, userId } = await session();
  fail((await db.from("user_targets").upsert({ user_id: userId, restaurant_id: restaurantId, ...parsed, updated_at: new Date().toISOString() })).error);
}
