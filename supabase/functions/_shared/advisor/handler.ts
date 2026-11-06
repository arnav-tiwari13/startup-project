import { ADVISOR_CONFIG } from "./config.ts";
import { runAdvisorTurn, type ApiMessage, type ModelClient } from "./agent.ts";
import { renderAnswerText, SUBMIT_ANSWER_TOOL, type Answer } from "./answer.ts";
import type { Chip, ContextError, WidgetContext } from "../widgets/context.ts";
import { renderContextBlock } from "../widgets/context.ts";
import { WIDGETS } from "../widgets/registry.ts";
import type { DataSourceFactory } from "./data-source.ts";
import { describeError } from "./errors.ts";
import { checkRateLimit, conversationHasRoom, validateUserMessage } from "./limits.ts";
import type { AdvisorStore } from "./store.ts";
import { TOOL_DEFINITIONS } from "./tools.ts";

export type AdvisorEvent =
  | { type: "meta"; conversationId: string }
  | { type: "text"; text: string }
  | { type: "context"; chip: Chip }
  | { type: "answer"; answer: Answer }
  | { type: "tool"; name: string }
  | { type: "done" }
  | { type: "error"; code: ErrorCode; message: string; retryAfterSec?: number };

export type ErrorCode =
  | "empty" | "too_long" | "bad_context" | "no_restaurant" | "rate_limited" | "not_found" | "conversation_full" | "model_error";

export interface HandlerDeps {
  store: AdvisorStore;
  model: ModelClient;
  getData: DataSourceFactory;
  systemPrompt: string;
  /** Re-runs the shared queries for a click reference and returns verified context. Absent means clicks are refused. */
  buildContext?: (raw: unknown, restaurantId: string) => Promise<{ ok: true; context: WidgetContext } | { ok: false; error: ContextError }>;
  now?: () => number;
}

const CLICK_RULES = `The owner clicked something on their dashboard and wants it explained. Rules for this answer:
- Base every number on the verified context below or on a tool result. If data is missing, put it in missing_data and say what is needed. Do not guess or fill gaps.
- Finish by calling submit_answer exactly once. Do not write the answer as plain text.
- Each recommended action needs an estimated dollars-per-month impact with the arithmetic in impact_basis (null if it cannot be estimated), the effort, and the main risk. Offer no action rather than a weak one.`;

/**
 * Handles one chat message for one signed-in user. `userId` must come from a verified login token,
 * never from the request body. The restaurant is always looked up from the user, never accepted from the client.
 */
export async function handleChat(
  deps: HandlerDeps,
  req: { userId: string; message: unknown; conversationId?: unknown; context?: unknown },
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

  // A click reference is rebuilt into verified context on every message, so follow-ups keep it until the owner clears it.
  let widget: WidgetContext | null = null;
  if (req.context !== undefined && req.context !== null) {
    const built = deps.buildContext ? await deps.buildContext(req.context, restaurantId) : null;
    // One answer for every failure (malformed, someone else's restaurant, no such row), so it reveals nothing.
    if (!built || !built.ok) return fail("bad_context", "That part of the dashboard couldn't be found. Close the panel and click it again.");
    widget = built.context;
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
  if (widget) emit({ type: "context", chip: widget.chip });
  await store.appendMessage({ conversationId, userId: req.userId, restaurantId, role: "user", content: check.text });

  try {
    const def = widget ? WIDGETS[widget.widget_id] : null;
    const result = await runAdvisorTurn({
      model: deps.model,
      system: widget && def ? `${deps.systemPrompt}\n\n${CLICK_RULES}\n\nPlaybook for ${def.title}:\n${def.playbook}\n\n${renderContextBlock(widget)}` : deps.systemPrompt,
      tools: def ? [...TOOL_DEFINITIONS.filter((t) => def.tools.includes(t.name as (typeof def.tools)[number])), SUBMIT_ANSWER_TOOL] : TOOL_DEFINITIONS,
      structured: def ? { allowedTools: def.tools, onAnswer: (answer) => emit({ type: "answer", answer }) } : undefined,
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
    // Log a redacted description (type, status, short message) so problems can be diagnosed without leaking secrets.
    console.error("advisor model error:", describeError(err));
    fail("model_error", "The advisor ran into a problem. Please try again.");
  }
}
