// The action list: recommendations the owner saved. Runs as the signed-in user, so row-level security keeps it to their own rows.
import type { AnswerAction } from "../../supabase/functions/_shared/advisor/answer.ts";
import { supabase } from "../supabase";

export type ActionStatus = "open" | "done" | "dismissed";
export interface ActionItem {
  id: string; widget_id: string; title: string; detail: string; impact_cents: number | null; impact_basis: string;
  effort: "low" | "medium" | "high"; risk: string; status: ActionStatus; created_at: string;
}

const COLUMNS = "id, widget_id, title, detail, impact_cents, impact_basis, effort, risk, status, created_at";
const db = () => {
  if (!supabase) throw new Error("not_configured");
  return supabase;
};

export async function saveAction(widgetId: string, a: AnswerAction): Promise<void> {
  const { data: user } = await db().auth.getUser();
  if (!user.user) throw new Error("not signed in");
  // The same restaurant the advisor answers for: the user's first membership. The database re-checks membership.
  const { data: members, error: memberError } = await db().from("restaurant_members").select("restaurant_id").eq("user_id", user.user.id).order("restaurant_id").limit(1);
  if (memberError || !members?.[0]) throw new Error("no restaurant");
  const { error } = await db().from("action_items").insert({
    user_id: user.user.id, restaurant_id: members[0].restaurant_id, widget_id: widgetId,
    title: a.title, detail: a.detail, impact_cents: a.impact_dollars === null ? null : Math.round(a.impact_dollars * 100),
    impact_basis: a.impact_basis, effort: a.effort, risk: a.risk,
  });
  if (error) throw new Error("save failed");
}

export async function listActions(): Promise<ActionItem[]> {
  const { data, error } = await db().from("action_items").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("load failed");
  return (data ?? []) as ActionItem[];
}

export async function setActionStatus(id: string, status: ActionStatus): Promise<void> {
  const { error } = await db().from("action_items").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("update failed");
}

export async function deleteAction(id: string): Promise<void> {
  const { error } = await db().from("action_items").delete().eq("id", id);
  if (error) throw new Error("delete failed");
}
