// Supabase Edge Function (Deno): POST /functions/v1/advisor
// Body: { message: string, conversationId?: string }. Response: server-sent events (see AdvisorEvent).
//
// Secrets (set with `supabase secrets set`, never in code): ANTHROPIC_API_KEY.
// Optional: ANTHROPIC_MODEL, ANTHROPIC_EFFORT, ANTHROPIC_FALLBACKS=off.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided to every function automatically.
import { createClient } from "@supabase/supabase-js";
import { createAnthropicClient } from "../_shared/advisor/anthropic.ts";
import { resolveModelSettings } from "../_shared/advisor/config.ts";
import { describeError } from "../_shared/advisor/errors.ts";
import { createRestaurantData } from "../_shared/advisor/data-source.ts";
import { handleChat, type AdvisorEvent } from "../_shared/advisor/handler.ts";
import { SupabaseAdvisorStore } from "../_shared/advisor/supabase-store.ts";
import { buildSystemPrompt } from "../_shared/advisor/system-prompt.ts";

const PRODUCT_NAME = "platecfo";
const MAX_BODY_BYTES = 16_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // 1. Who is calling? Verified by Supabase Auth, never taken from the request body.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthorized" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } }, // row-level security runs as this user
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "unauthorized" });
  const userId = userData.user.id;

  // 2. Read a small JSON body.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_request" });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return json(503, { error: "not_configured" });
  }

  const settings = resolveModelSettings({
    ANTHROPIC_MODEL: Deno.env.get("ANTHROPIC_MODEL"),
    ANTHROPIC_EFFORT: Deno.env.get("ANTHROPIC_EFFORT"),
    ANTHROPIC_FALLBACKS: Deno.env.get("ANTHROPIC_FALLBACKS"),
  });
  const deps = {
    store: new SupabaseAdvisorStore(supabase),
    model: createAnthropicClient({ apiKey, ...settings }),
    getData: createRestaurantData,
    systemPrompt: buildSystemPrompt(PRODUCT_NAME),
  };

  // 3. Stream the answer as server-sent events.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AdvisorEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await handleChat(deps, { userId, message: body.message, conversationId: body.conversationId }, send);
      } catch (err) {
        console.error("advisor failure:", describeError(err));
        send({ type: "error", code: "model_error", message: "Something went wrong. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});
