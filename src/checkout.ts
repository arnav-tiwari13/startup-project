import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

/** Asks the create-checkout function for a Stripe Checkout URL and sends the browser there. */
export async function startCheckout(): Promise<void> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) throw new Error("Sign-in isn't set up, so checkout isn't available.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in to subscribe.");

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey, "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Couldn't reach checkout. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as { url?: string } | null;
  if (!res.ok || !body?.url) throw new Error("Checkout isn't available right now. Please try again.");
  window.location.assign(body.url);
}
