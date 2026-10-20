import type { AdvisorStore, StoredMessage } from "./store.ts";

interface Conv { id: string; userId: string; restaurantId: string }
interface Msg extends StoredMessage { conversationId: string; userId: string; restaurantId: string; at: number }
export interface ToolLog { conversationId: string; userId: string; restaurantId: string; toolName: string; input: unknown; ok: boolean; error?: string; durationMs: number }

/** In-memory store for tests and local experiments. Mirrors the access rules of the real database. */
export class MemoryAdvisorStore implements AdvisorStore {
  memberships = new Map<string, string>(); // userId -> restaurantId
  conversations: Conv[] = [];
  messages: Msg[] = [];
  toolLogs: ToolLog[] = [];
  private n = 0;
  private readonly clock: () => number;
  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
  }

  async getRestaurantIdForUser(userId: string) { return this.memberships.get(userId) ?? null; }

  async getConversation(conversationId: string, userId: string) {
    const c = this.conversations.find((x) => x.id === conversationId && x.userId === userId);
    if (!c) return null;
    return { id: c.id, restaurantId: c.restaurantId, messageCount: this.messages.filter((m) => m.conversationId === c.id).length };
  }

  async createConversation(userId: string, restaurantId: string) {
    const id = `conv-${++this.n}`;
    this.conversations.push({ id, userId, restaurantId });
    return id;
  }

  async getMessages(conversationId: string, userId: string) {
    if (!this.conversations.some((c) => c.id === conversationId && c.userId === userId)) return [];
    return this.messages.filter((m) => m.conversationId === conversationId).map(({ role, content }) => ({ role, content }));
  }

  async appendMessage(m: { conversationId: string; userId: string; restaurantId: string; role: "user" | "assistant"; content: string }) {
    this.messages.push({ ...m, at: this.clock() });
  }

  async logToolCall(c: ToolLog) { this.toolLogs.push(c); }

  async countUserMessagesSince(userId: string, sinceIso: string) {
    const since = Date.parse(sinceIso);
    return this.messages.filter((m) => m.userId === userId && m.role === "user" && m.at >= since).length;
  }
}
