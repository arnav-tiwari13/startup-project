import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdvisorStore, StoredMessage } from "./store.ts";

/**
 * Database-backed store. The client passed in must be created with the CALLER'S access token, so
 * Postgres row-level security applies on top of the explicit user filters below (defence in depth).
 */
export class SupabaseAdvisorStore implements AdvisorStore {
  private readonly db: SupabaseClient;
  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async getRestaurantIdForUser(userId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from("restaurant_members").select("restaurant_id")
      .eq("user_id", userId).order("restaurant_id").limit(1);
    if (error) throw new Error(`store: ${error.message}`);
    return data?.[0]?.restaurant_id ?? null;
  }

  async getConversation(conversationId: string, userId: string) {
    const { data, error } = await this.db
      .from("chat_conversations").select("id, restaurant_id")
      .eq("id", conversationId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (error) throw new Error(`store: ${error.message}`);
    if (!data) return null;
    const { count, error: countError } = await this.db
      .from("chat_messages").select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId).eq("user_id", userId);
    if (countError) throw new Error(`store: ${countError.message}`);
    return { id: data.id as string, restaurantId: data.restaurant_id as string, messageCount: count ?? 0 };
  }

  async createConversation(userId: string, restaurantId: string): Promise<string> {
    const { data, error } = await this.db
      .from("chat_conversations").insert({ user_id: userId, restaurant_id: restaurantId }).select("id").single();
    if (error) throw new Error(`store: ${error.message}`);
    return data.id as string;
  }

  async getMessages(conversationId: string, userId: string): Promise<StoredMessage[]> {
    const { data, error } = await this.db
      .from("chat_messages").select("role, content")
      .eq("conversation_id", conversationId).eq("user_id", userId).order("id");
    if (error) throw new Error(`store: ${error.message}`);
    return (data ?? []) as StoredMessage[];
  }

  async appendMessage(m: { conversationId: string; userId: string; restaurantId: string; role: "user" | "assistant"; content: string }) {
    const { error } = await this.db.from("chat_messages").insert({
      conversation_id: m.conversationId, user_id: m.userId, restaurant_id: m.restaurantId, role: m.role, content: m.content,
    });
    if (error) throw new Error(`store: ${error.message}`);
  }

  async logToolCall(c: {
    conversationId: string; userId: string; restaurantId: string; toolName: string;
    input: unknown; ok: boolean; error?: string; durationMs: number;
  }) {
    const { error } = await this.db.from("chat_tool_calls").insert({
      conversation_id: c.conversationId, user_id: c.userId, restaurant_id: c.restaurantId, tool_name: c.toolName,
      input: c.input ?? null, ok: c.ok, error: c.error ?? null, duration_ms: c.durationMs,
    });
    if (error) throw new Error(`store: ${error.message}`);
  }

  async countUserMessagesSince(userId: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.db
      .from("chat_messages").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("role", "user").gte("created_at", sinceIso);
    if (error) throw new Error(`store: ${error.message}`);
    return count ?? 0;
  }
}
