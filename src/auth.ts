import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/overview` },
  });

const homeUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

export const signInWithEmail = (email: string, password: string) =>
  supabase!.auth.signInWithPassword({ email, password });

export const signUpWithEmail = (email: string, password: string) =>
  supabase!.auth.signUp({ email, password, options: { emailRedirectTo: `${homeUrl()}#/overview` } });

export const sendPasswordReset = (email: string) =>
  supabase!.auth.resetPasswordForEmail(email, { redirectTo: homeUrl() });

export const setNewPassword = (password: string) => supabase!.auth.updateUser({ password });

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

// True after the user lands from a password-reset email, until they set a new password.
export function usePasswordRecovery(): [boolean, () => void] {
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return [recovering, () => setRecovering(false)];
}
