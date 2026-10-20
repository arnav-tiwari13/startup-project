/** Persistence the advisor needs. Every method is scoped by the user (and so their restaurant). */
export interface StoredMessage { role: "user" | "assistant"; content: string }

export interface AdvisorStore {
  /** The restaurant this signed-in user belongs to, or null if none. Never trusts the client. */
  getRestaurantIdForUser(userId: string): Promise<string | null>;
  /** A conversation only if it belongs to this user; otherwise null. */
  getConversation(conversationId: string, userId: string): Promise<{ id: string; restaurantId: string; messageCount: number } | null>;
  createConversation(userId: string, restaurantId: string): Promise<string>;
  getMessages(conversationId: string, userId: string): Promise<StoredMessage[]>;
  appendMessage(m: { conversationId: string; userId: string; restaurantId: string; role: "user" | "assistant"; content: string }): Promise<void>;
  logToolCall(c: {
    conversationId: string; userId: string; restaurantId: string; toolName: string;
    input: unknown; ok: boolean; error?: string; durationMs: number;
  }): Promise<void>;
  countUserMessagesSince(userId: string, sinceIso: string): Promise<number>;
}
