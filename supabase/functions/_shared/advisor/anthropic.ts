import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, ModelClient } from "./agent.ts";

export interface AnthropicSettings {
  apiKey: string;
  model: string;
  effort: string;
  maxTokens: number;
  /** Re-run on another model server-side if a safety classifier declines the request. */
  fallbacks: boolean;
}

/**
 * Real model client. Streams text deltas to `onText` and returns the complete message.
 * The API key is passed in by the caller (read from a server-side secret); it is never logged.
 * Opus 5.5: thinking is always on and sampling parameters are not accepted, so neither is sent.
 */
export function createAnthropicClient(settings: AnthropicSettings): ModelClient {
  const client = new Anthropic({ apiKey: settings.apiKey });
  return {
    async stream(params, onText) {
      const body = {
        model: settings.model,
        max_tokens: settings.maxTokens,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
        output_config: { effort: settings.effort },
        // Typings can lag newer request fields, so the body is assembled loosely and cast once.
        ...(settings.fallbacks ? { fallbacks: "default" } : {}),
      };
      const stream = client.messages.stream(
        body as unknown as Anthropic.MessageStreamParams,
        settings.fallbacks ? { headers: { "anthropic-beta": "server-side-fallback-2026-07-01" } } : undefined,
      );
      stream.on("text", onText);
      const final = await stream.finalMessage();
      return { content: final.content as unknown as ContentBlock[], stop_reason: final.stop_reason };
    },
  };
}
