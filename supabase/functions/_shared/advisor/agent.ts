import { executeTool, type ToolDefinition } from "./tools.ts";
import type { RestaurantData } from "./types.ts";

export type ContentBlock = { type: string; [key: string]: unknown };
export interface ApiMessage { role: "user" | "assistant"; content: string | ContentBlock[] }
export interface ModelResponse { content: ContentBlock[]; stop_reason: string | null }

/** The only thing the loop needs from a model. The Anthropic SDK adapter lives in anthropic.ts. */
export interface ModelClient {
  stream(
    params: { system: string; messages: ApiMessage[]; tools: ToolDefinition[] },
    onText: (delta: string) => void,
  ): Promise<ModelResponse>;
}

export interface ToolCallRecord { name: string; input: unknown; ok: boolean; error?: string; durationMs: number }
export interface TurnResult { text: string; toolCalls: ToolCallRecord[]; stopReason: string }

export const REFUSAL_TEXT = "I can't help with that request. I can help with your food costs, pricing, inventory, vendors and sales.";
const TOO_MANY_TOOLS = "I couldn't finish that analysis in one go. Try a narrower question, such as one period or one item.";

/** Runs one user message to completion: call the model, run requested tools, repeat until it answers. */
export async function runAdvisorTurn(opts: {
  model: ModelClient;
  system: string;
  tools: ToolDefinition[];
  history: ApiMessage[];
  data: RestaurantData;
  maxIterations: number;
  onText: (delta: string) => void;
  onToolCall?: (name: string) => void;
}): Promise<TurnResult> {
  const convo: ApiMessage[] = [...opts.history];
  const toolCalls: ToolCallRecord[] = [];
  let text = "";
  let emitted = false;

  const emit = (delta: string) => {
    if (!delta) return;
    text += delta;
    emitted = true;
    opts.onText(delta);
  };

  for (let i = 0; i < opts.maxIterations; i++) {
    let separate = emitted; // blank line between text from different model calls
    const resp = await opts.model.stream(
      { system: opts.system, messages: convo, tools: opts.tools },
      (d) => {
        if (separate && d) { emit("\n\n"); separate = false; }
        emit(d);
      },
    );

    if (resp.stop_reason === "refusal") {
      if (!emitted) emit(REFUSAL_TEXT);
      return { text, toolCalls, stopReason: "refusal" };
    }

    convo.push({ role: "assistant", content: resp.content });
    if (resp.stop_reason !== "tool_use") {
      if (!emitted) emit("I wasn't able to produce an answer. Please try rephrasing.");
      return { text, toolCalls, stopReason: resp.stop_reason ?? "end_turn" };
    }

    const results: ContentBlock[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      const name = String(block.name);
      opts.onToolCall?.(name);
      const t0 = Date.now();
      const outcome = executeTool(opts.data, name, block.input);
      toolCalls.push({
        name, input: block.input, ok: outcome.ok,
        error: outcome.ok ? undefined : outcome.error, durationMs: Date.now() - t0,
      });
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }),
        is_error: !outcome.ok,
      });
    }
    convo.push({ role: "user", content: results });
  }

  emit(emitted ? `\n\n${TOO_MANY_TOOLS}` : TOO_MANY_TOOLS);
  return { text, toolCalls, stopReason: "max_iterations" };
}
