// Runs every chat case against the REAL model. This calls the Anthropic API and costs money, so it only runs when
// explicitly asked:  npm run test:live   (needs ANTHROPIC_API_KEY in your shell; never put the key in code).
import { describe, expect, it } from "vitest";
import { createAnthropicClient } from "../../supabase/functions/_shared/advisor/anthropic.ts";
import { resolveModelSettings } from "../../supabase/functions/_shared/advisor/config.ts";
import { createRestaurantData } from "../../supabase/functions/_shared/advisor/data-source.ts";
import { handleChat } from "../../supabase/functions/_shared/advisor/handler.ts";
import { MemoryAdvisorStore } from "../../supabase/functions/_shared/advisor/memory-store.ts";
import { SAMPLE_RESTAURANT_ID, SAMPLE_RESTAURANT_ID_2 } from "../../supabase/functions/_shared/advisor/mock-data.ts";
import { buildSystemPrompt } from "../../supabase/functions/_shared/advisor/system-prompt.ts";
import { collect } from "./helpers.ts";
import { CHAT_CASES, grade } from "./chat-cases.ts";

const live = Boolean(process.env.RUN_LIVE_EVALS && process.env.ANTHROPIC_API_KEY);

describe.skipIf(!live)("live chat cases (real model)", () => {
  const settings = resolveModelSettings(process.env);
  const model = createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY!, ...settings });

  it.each(CHAT_CASES)("$category / $id", async (c) => {
    const store = new MemoryAdvisorStore();
    const userId = `eval-${c.id}`; // one user per case so the rate limiter never interferes
    store.memberships.set(userId, c.business === "cedar" ? SAMPLE_RESTAURANT_ID : SAMPLE_RESTAURANT_ID_2);
    const out = await collect((emit) =>
      handleChat({ store, model, getData: createRestaurantData, systemPrompt: buildSystemPrompt("platecfo") }, { userId, message: c.message }, emit),
    );
    expect(out.error, `unexpected error: ${out.error?.code}`).toBeUndefined();
    const problems = grade(c, { text: out.text, tools: out.tools });
    expect(problems, `${c.message}\n--- answer ---\n${out.text}`).toEqual([]);
  }, 180_000);
});
