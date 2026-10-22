// Supabase Edge Function (Deno): POST /functions/v1/table-data
// Body: a table request (see _shared/tables/schema.ts). Response: rows and cells for one dashboard table.
//
// No secrets needed. SUPABASE_URL and SUPABASE_ANON_KEY are provided to every function automatically.
// Queries run as the signed-in user, so row-level security limits every read to their own restaurants.
import { createClient } from "@supabase/supabase-js";
import { describeError } from "../_shared/advisor/errors.ts";
import { loadBundle } from "../_shared/tables/data.ts";
import { handleTableData } from "../_shared/tables/handler.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthorized" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } }, // row-level security runs as this user
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await handleTableData(
      {
        userId: async () => {
          const { data, error } = await supabase.auth.getUser(token);
          return error || !data.user ? null : data.user.id;
        },
        memberships: async () => {
          const { data, error } = await supabase.from("restaurant_members").select("restaurant_id");
          if (error) throw new Error("loading memberships failed");
          return (data ?? []).map((m) => m.restaurant_id as string);
        },
        load: (userId, ids, needs) => loadBundle(supabase, userId, ids, needs),
        today: () => new Date().toISOString().slice(0, 10),
      },
      await req.text(),
    );
    return json(result.status, result.body);
  } catch (err) {
    console.error("table-data failure:", describeError(err));
    return json(500, { error: "failed" });
  }
});
