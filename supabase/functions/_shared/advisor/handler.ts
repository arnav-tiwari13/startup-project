import { ADVISOR_CONFIG } from "./config.ts";
import { runAdvisorTurn, type ApiMessage, type ModelClient } from "./agent.ts";
import type { DataSourceFactory } from "./data-source.ts";
import { checkRateLimit, conversationHasRoom, validateUserMessage } from "./limits.ts";
import type { AdvisorStore } from "./store.ts";
import { TOOL_DEFINITIONS } from "./tools.ts";

export type AdvisorEvent =
  | { type: "meta"; conversationId: string }
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "done" }
  | { type: "error"; code: ErrorCode; message: string; retryAfterSec?: number };

export type ErrorCode =
  | "empty" | "too_long" | "no_restaurant" | "rate_limited" | "not_found" | "conversation_full" | "model_error";

export interface HandlerDeps {
  store: AdvisorStore;
  model: ModelClient;
  getData: DataSourceFactory;
  systemPrompt: string;
  now?: () => number;
}

/**
 * Handles one chat message for one signed-in user. `userId` must come from a verified login token,
 * never from the request body. The restaurant is always looked up from the user, never accepted from the client.
 */
export async function handleChat(
  deps: HandlerDeps,
  req: { userId: string; message: unknown; conversationId?: unknown },
  emit: (e: AdvisorEvent) => void,
): Promise<void> {
  const { store } = deps;
  const fail = (code: ErrorCode, message: string, retryAfterSec?: number) => emit({ type: "error", code, message, retryAfterSec });

  const check = validateUserMessage(req.message);
  if (!check.ok) return fail(check.code, check.message);

  const restaurantId = await store.getRestaurantIdForUser(req.userId);
  if (!restaurantId) return fail("no_restaurant", "Your account isn't linked to a business yet.");

  const rate = await checkRateLimit(store, req.userId, (deps.now ?? Date.now)());
  if (!rate.allowed) {
    return fail("rate_limited", "You're sending messages too quickly. Please wait a moment.", rate.retryAfterSec);
  }

  let conversationId: string;
  let history: ApiMessage[] = [];
  if (typeof req.conversationId === "string" && req.conversationId) {
    const conv = await store.getConversation(req.conversationId, req.userId);
    // Same answer whether it doesn't exist or belongs to someone else.
    if (!conv || conv.restaurantId !== restaurantId) return fail("not_found", "That conversation wasn't found.");
    if (!conversationHasRoom(conv.messageCount)) {
      return fail("conversation_full", "This conversation is full. Start a new chat to keep going.");
    }
    conversationId = conv.id;
    history = (await store.getMessages(conv.id, req.userId)).map((m) => ({ role: m.role, content: m.content }));
  } else {
    conversationId = await store.createConversation(req.userId, restaurantId);
  }

  emit({ type: "meta", conversationId });
  await store.appendMessage({ conversationId, userId: req.userId, restaurantId, role: "user", content: check.text });

  try {
    const result = await runAdvisorTurn({
      model: deps.model,
      system: deps.systemPrompt,
      tools: TOOL_DEFINITIONS,
      history: [...history, { role: "user", content: check.text }],
      data: deps.getData(restaurantId),
      maxIterations: ADVISOR_CONFIG.maxToolIterations,
      onText: (text) => emit({ type: "text", text }),
      onToolCall: (name) => emit({ type: "tool", name }),
    });

    for (const c of result.toolCalls) {
      await store.logToolCall({
        conversationId, userId: req.userId, restaurantId, toolName: c.name,
        input: c.input, ok: c.ok, error: c.error, durationMs: c.durationMs,
      });
    }
    if (result.text) {
      await store.appendMessage({ conversationId, userId: req.userId, restaurantId, role: "assistant", content: result.text });
    }
    emit({ type: "done" });
  } catch (err) {
    // Log the error class only: provider errors can carry request details we don't want in logs.
    console.error("advisor model error:", err instanceof Error ? err.name : "unknown");
    fail("model_error", "The advisor ran into a problem. Please try again.");
  }
}
