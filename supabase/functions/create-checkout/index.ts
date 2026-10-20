// Supabase Edge Function (Deno): POST /functions/v1/create-checkout
// Starts a Stripe Checkout session for the $99/month platecfo subscription.
// Response: { url } — the hosted Checkout page to send the browser to.
//
// Secrets (set with `supabase secrets set`, never in code):
//   STRIPE_SECRET_KEY  the sandbox secret key (sk_test_...) for now, the live key later
//   STRIPE_PRICE_ID    the recurring price to subscribe to
//   SITE_URL           where Stripe sends people back, e.g. https://example.com/app/ (no hash)
// SUPABASE_URL and SUPABASE_ANON_KEY are provided to every function automatically.
import { createClient } from "@supabase/supabase-js";

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

  // Who is calling? Verified by Supabase Auth, never taken from the request body.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthorized" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json(401, { error: "unauthorized" });
  const user = data.user;

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const priceId = Deno.env.get("STRIPE_PRICE_ID");
  const siteUrl = Deno.env.get("SITE_URL");
  if (!secretKey || !priceId || !siteUrl) {
    console.error("create-checkout is missing STRIPE_SECRET_KEY, STRIPE_PRICE_ID or SITE_URL");
    return json(503, { error: "not_configured" });
  }

  // Redirect targets come from our own config, so a caller can't point Stripe at another site.
  const base = siteUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${base}/#/overview?checkout=success`,
    cancel_url: `${base}/#/overview?checkout=cancelled`,
    client_reference_id: user.id,
    "subscription_data[metadata][user_id]": user.id,
    "metadata[user_id]": user.id,
  });
  if (user.email) params.set("customer_email", user.email);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await res.json().catch(() => null);
  if (!res.ok || !session?.url) {
    // Log Stripe's error type and code only, never the request or response body.
    console.error("stripe checkout failed:", res.status, session?.error?.type, session?.error?.code);
    return json(502, { error: "checkout_failed" });
  }
  return json(200, { url: session.url });
});
