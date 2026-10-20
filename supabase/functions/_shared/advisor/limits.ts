import { ADVISOR_CONFIG } from "./config.ts";
import type { AdvisorStore } from "./store.ts";

export type MessageCheck = { ok: true; text: string } | { ok: false; code: "empty" | "too_long"; message: string };

export function validateUserMessage(raw: unknown, maxChars: number = ADVISOR_CONFIG.maxMessageChars): MessageCheck {
  if (typeof raw !== "string" || raw.trim().length === 0) return { ok: false, code: "empty", message: "Type a question first." };
  const text = raw.trim();
  if (text.length > maxChars) {
    return { ok: false, code: "too_long", message: `Messages can be up to ${maxChars} characters. Yours is ${text.length}.` };
  }
  return { ok: true, text };
}

export function conversationHasRoom(messageCount: number, cap: number = ADVISOR_CONFIG.maxConversationMessages): boolean {
  return messageCount < cap;
}

export type RateCheck = { allowed: true } | { allowed: false; retryAfterSec: number; reason: "minute" | "day" };

/** Counts the user's own recent messages in the store, so the limit holds across function instances. */
export async function checkRateLimit(
  store: Pick<AdvisorStore, "countUserMessagesSince">,
  userId: string,
  nowMs: number,
  limits: { perMinute: number; perDay: number } = ADVISOR_CONFIG.rateLimit,
): Promise<RateCheck> {
  const lastMinute = await store.countUserMessagesSince(userId, new Date(nowMs - 60_000).toISOString());
  if (lastMinute >= limits.perMinute) return { allowed: false, retryAfterSec: 60, reason: "minute" };
  const lastDay = await store.countUserMessagesSince(userId, new Date(nowMs - 86_400_000).toISOString());
  if (lastDay >= limits.perDay) return { allowed: false, retryAfterSec: 3600, reason: "day" };
  return { allowed: true };
}
