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
export const MAX_TITLE_CHARS = 100;

/** A typed title, trimmed to one line; null when it is empty or too long to save. */
export function cleanTitle(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= MAX_TITLE_CHARS ? t : null;
}

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
  type Row = { id: string; created_at: string; title?: string | null };
  let convos: Row[] | null;
  const res = await supabase
    .from("chat_conversations").select("id, created_at, title").is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (res.error) {
    // Before the rename/delete migration is applied those columns don't exist; list without them.
    const old = await supabase.from("chat_conversations").select("id, created_at").order("created_at", { ascending: false }).limit(limit);
    if (old.error) throw new Error(old.error.message);
    convos = old.data as Row[];
  } else {
    convos = res.data as Row[];
  }
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
    .map((c) => ({ id: c.id as string, createdAt: c.created_at as string, title: c.title?.trim() || titleFrom(firstQuestion.get(c.id as string)) }));
}

export async function loadConversation(id: string): Promise<SavedMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("chat_messages").select("role, content").eq("conversation_id", id).order("id");
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedMessage[];
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const clean = cleanTitle(title);
  if (!supabase || !clean) throw new Error("Enter a name up to 100 characters.");
  const { error } = await supabase.from("chat_conversations").update({ title: clean }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Hides the conversation from its owner. The messages stay stored (see the chat_rename_delete migration). */
export async function deleteConversation(id: string): Promise<void> {
  if (!supabase) throw new Error("Sign-in isn't configured.");
  const { error } = await supabase.from("chat_conversations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
