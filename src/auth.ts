import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/overview` },
  });

export const signOut = () => supabase?.auth.signOut();

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
