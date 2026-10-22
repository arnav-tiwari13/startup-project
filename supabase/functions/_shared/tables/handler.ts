// The request handling for POST /functions/v1/table-data, with its dependencies injected so it can be tested
// without Deno or a database. The Edge Function wires real implementations in.
import type { Bundle, Needs } from "./data.ts";
import { emptyBundle } from "./data.ts";
import { tableRequestSchema } from "./schema.ts";
import { chooseRestaurants, executeTable, planTable } from "./run.ts";

export const MAX_BODY_BYTES = 8_000;

export interface TableDataDeps {
  /** The signed-in user's id, verified by Supabase Auth, or null. Never taken from the request body. */
  userId: () => Promise<string | null>;
  /** Restaurant ids the signed-in user belongs to. */
  memberships: () => Promise<string[]>;
  /** Loads the rows a table needs, as the signed-in user. */
  load: (userId: string, restaurantIds: string[], needs: Needs) => Promise<Bundle>;
  /** Today's UTC date, YYYY-MM-DD. */
  today: () => string;
}

export interface HandlerResult { status: number; body: unknown }

export async function handleTableData(deps: TableDataDeps, rawBody: string): Promise<HandlerResult> {
  const userId = await deps.userId();
  if (!userId) return { status: 401, body: { error: "unauthorized" } };

  if (rawBody.length > MAX_BODY_BYTES) return { status: 413, body: { error: "too_large" } };
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "bad_request" } };
  }
  const parsed = tableRequestSchema.safeParse(json);
  if (!parsed.success) {
    // Paths and messages only, never the submitted values.
    return { status: 400, body: { error: "bad_request", issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) } };
  }
  const req = parsed.data;

  const planned = planTable(req, deps.today());
  if (!planned.ok) return { status: 400, body: { error: planned.error } };

  const chosen = chooseRestaurants(req.restaurantIds, await deps.memberships());
  if (!chosen.ok) return { status: 403, body: { error: "forbidden" } };

  const bundle = chosen.ids.length ? await deps.load(userId, chosen.ids, planned.plan.needs) : emptyBundle();
  return { status: 200, body: executeTable(planned.plan, bundle, chosen.ids) };
}
