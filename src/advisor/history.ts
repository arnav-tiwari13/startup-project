import { supabase } from "../supabase";

export interface ConversationSummary {
  id: string;
  createdAt: string;
  title: string;
}

export interface SavedMessage {
  role: "user" | "assistant";
  content: string;
}

const TITLE_CHARS = 60;

/** A conversation is titled by its first question, trimmed to one short line. */
export function titleFrom(firstQuestion: string | undefined): string {
  const oneLine = (firstQuestion ?? "").replace(/\s+/g, " ").trim();
  if (!oneLine) return "New conversation";
  return oneLine.length > TITLE_CHARS ? `${oneLine.slice(0, TITLE_CHARS - 1).trimEnd()}…` : oneLine;
}

const GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Groups newest-first conversations into Today / Yesterday / Previous 7 days / Older, dropping empty groups. */
export function groupByRecency(items: ConversationSummary[], now = new Date()): { label: string; items: ConversationSummary[] }[] {
  const today = dayStart(now);
  const DAY = 24 * 60 * 60 * 1000;
  const buckets: Record<(typeof GROUPS)[number], ConversationSummary[]> = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const c of items) {
    const t = dayStart(new Date(c.createdAt));
    const key = t >= today ? "Today" : t >= today - DAY ? "Yesterday" : t >= today - 7 * DAY ? "Previous 7 days" : "Older";
    buckets[key].push(c);
  }
  return GROUPS.filter((g) => buckets[g].length > 0).map((g) => ({ label: g, items: buckets[g] }));
}

// Row-level security limits both queries to the signed-in user's own conversations and messages.
export async function listConversations(limit = 50): Promise<ConversationSummary[]> {
  if (!supabase) return [];
  const { data: convos, error } = await supabase
    .from("chat_conversations").select("id, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  if (!convos || convos.length === 0) return [];

  const { data: firsts, error: msgError } = await supabase
    .from("chat_messages").select("conversation_id, content")
    .in("conversation_id", convos.map((c) => c.id as string)).eq("role", "user").order("id");
  if (msgError) throw new Error(msgError.message);

  const firstQuestion = new Map<string, string>();
  for (const m of firsts ?? []) if (!firstQuestion.has(m.conversation_id as string)) firstQuestion.set(m.conversation_id as string, m.content as string);

  // A conversation with no saved question (the first send failed) isn't worth listing.
  return convos
    .filter((c) => firstQuestion.has(c.id as string))
    .map((c) => ({ id: c.id as string, createdAt: c.created_at as string, title: titleFrom(firstQuestion.get(c.id as string)) }));
}

export async function loadConversation(id: string): Promise<SavedMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("chat_messages").select("role, content").eq("conversation_id", id).order("id");
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedMessage[];
}
