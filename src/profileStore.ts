import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toPayload, validate, type Profile, type ProfileForm } from "./profile";
import { supabase } from "./supabase";

export type ProfileState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; profile: Profile }
  | { status: "error"; message: string };

// Loads the signed-in user's business profile (row-level security limits the query to their restaurants).
export function useProfileLoader(userId: string | undefined): { state: ProfileState; reload: () => void } {
  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!supabase || !userId) return;
    let live = true;
    setState({ status: "loading" });
    supabase
      .from("restaurant_profiles")
      .select("*")
      .order("created_at")
      .limit(1)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setState({ status: "error", message: error.message });
        else if (data && data.length > 0) setState({ status: "ready", profile: data[0] as Profile });
        else setState({ status: "none" });
      });
    return () => {
      live = false;
    };
  }, [userId, tick]);

  return { state, reload };
}

export async function saveProfile(form: ProfileForm): Promise<void> {
  if (!supabase) throw new Error("Sign-in isn't configured.");
  const errors = validate(form);
  if (Object.keys(errors).length > 0) throw new Error("Please fix the highlighted fields.");
  const { error } = await supabase.rpc("save_restaurant_profile", { p: toPayload(form) });
  if (error) throw new Error(error.message);
}

export const ProfileContext = createContext<{ profile: Profile | null; reload: () => void }>({ profile: null, reload: () => {} });
export const useProfile = () => useContext(ProfileContext);
