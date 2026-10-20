import type { AdvisorEvent } from "../../supabase/functions/_shared/advisor/handler.ts";
import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase";
import { createSseParser } from "./sse";

export class AdvisorRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Sends one message and reports each streamed event. Resolves when the stream ends. */
export async function streamAdvisor(opts: {
  message: string;
  conversationId?: string;
  signal?: AbortSignal;
  onEvent: (e: AdvisorEvent) => void;
}): Promise<void> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new AdvisorRequestError("not_configured", "Sign-in isn't set up, so the advisor isn't available.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdvisorRequestError("unauthorized", "Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/advisor`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ message: opts.message, conversationId: opts.conversationId }),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new AdvisorRequestError("network", "Couldn't reach the advisor. Check your connection and try again.");
  }

  if (!res.ok || !res.body) {
    const code = res.status === 401 ? "unauthorized" : res.status === 404 ? "unavailable" : res.status === 503 ? "not_configured" : "failed";
    const messages: Record<string, string> = {
      unauthorized: "Your session expired. Please sign in again.",
      unavailable: "The advisor isn't available yet.",
      not_configured: "The advisor isn't set up yet.",
      failed: "Something went wrong. Please try again.",
    };
    throw new AdvisorRequestError(code, messages[code]);
  }

  const parser = createSseParser(opts.onEvent);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
}
