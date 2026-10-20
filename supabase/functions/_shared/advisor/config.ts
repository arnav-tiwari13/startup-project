// Central settings for the advisor. Everything tunable lives here.
// The model name is a config value: set ANTHROPIC_MODEL on the function to override the default.

export const ADVISOR_CONFIG = {
  /** Default model. Override with the ANTHROPIC_MODEL secret, e.g. claude-sonnet-5-5 for lower cost. */
  defaultModel: "claude-opus-5-5",
  /** Thinking depth. Opus 5.5 defaults to "medium"; set explicitly so behaviour is stable. */
  defaultEffort: "medium" as "low" | "medium" | "high" | "xhigh" | "max",
  maxOutputTokens: 8000,
  /** Server-side fallback if a request is declined by a safety classifier. Disable with ANTHROPIC_FALLBACKS=off. */
  fallbacksEnabled: true,

  maxMessageChars: 2000,
  /** Total user + assistant messages kept in one conversation. */
  maxConversationMessages: 40,
  /** Model <-> tool round trips allowed for one user message. */
  maxToolIterations: 6,
  rateLimit: { perMinute: 6, perDay: 100 },
} as const;

export interface RuntimeEnv {
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_EFFORT?: string;
  ANTHROPIC_FALLBACKS?: string;
}

export function resolveModelSettings(env: RuntimeEnv) {
  const efforts = ["low", "medium", "high", "xhigh", "max"] as const;
  const effort = efforts.find((e) => e === env.ANTHROPIC_EFFORT) ?? ADVISOR_CONFIG.defaultEffort;
  return {
    model: env.ANTHROPIC_MODEL?.trim() || ADVISOR_CONFIG.defaultModel,
    effort,
    maxTokens: ADVISOR_CONFIG.maxOutputTokens,
    fallbacks: env.ANTHROPIC_FALLBACKS?.toLowerCase() !== "off" && ADVISOR_CONFIG.fallbacksEnabled,
  };
}
