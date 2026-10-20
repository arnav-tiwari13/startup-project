import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseUrl = url;
export const supabaseAnonKey = key;

export const authConfigured = Boolean(url && key);

// PKCE puts the auth code in ?code= instead of the URL hash, which the hash router owns.
export const supabase = authConfigured
  ? createClient(url!, key!, { auth: { flowType: "pkce" } })
  : null;
