import { describe, expect, it } from "vitest";
import { ADVISOR_CONFIG } from "../../supabase/functions/_shared/advisor/config.ts";
import { handleChat } from "../../supabase/functions/_shared/advisor/handler.ts";
import { checkRateLimit, conversationHasRoom, validateUserMessage } from "../../supabase/functions/_shared/advisor/limits.ts";
import { MemoryAdvisorStore } from "../../supabase/functions/_shared/advisor/memory-store.ts";
import { collect, makeDeps, say, scriptedModel } from "./helpers.ts";

describe("message length", () => {
  it("accepts a normal message and trims it", () => {
    expect(validateUserMessage("  hello  ")).toEqual({ ok: true, text: "hello" });
  });
  it("rejects empty and non-string input", () => {
    for (const v of ["", "   ", undefined, null, 42, {}]) expect(validateUserMessage(v)).toMatchObject({ ok: false, code: "empty" });
  });
  it("rejects messages over the maximum", () => {
    const max = ADVISOR_CONFIG.maxMessageChars;
    expect(validateUserMessage("a".repeat(max))).toMatchObject({ ok: true });
    expect(validateUserMessage("a".repeat(max + 1))).toMatchObject({ ok: false, code: "too_long" });
  });
  it("is enforced by the handler before anything else happens", async () => {
    const store = new MemoryAdvisorStore();
    const { model, calls } = scriptedModel([say("x")]);
    const out = await collect((emit) => handleChat(makeDeps(model, store), { userId: "u", message: "a".repeat(5000) }, emit));
    expect(out.error?.code).toBe("too_long");
    expect(calls).toHaveLength(0);
    expect(store.conversations).toHaveLength(0);
  });
});

describe("conversation length cap", () => {
  it("allows messages until the cap", () => {
    expect(conversationHasRoom(ADVISOR_CONFIG.maxConversationMessages - 1)).toBe(true);
    expect(conversationHasRoom(ADVISOR_CONFIG.maxConversationMessages)).toBe(false);
  });
  it("is enforced by the handler", async () => {
    const store = new MemoryAdvisorStore();
    store.memberships.set("u", "rest-a");
    const id = await store.createConversation("u", "rest-a");
    for (let i = 0; i < ADVISOR_CONFIG.maxConversationMessages; i++) {
      await store.appendMessage({ conversationId: id, userId: "u", restaurantId: "rest-a", role: i % 2 ? "assistant" : "user", content: "x" });
    }
    const { model, calls } = scriptedModel([say("x")]);
    const out = await collect((emit) => handleChat(makeDeps(model, store, () => Date.now() + 10 * 60_000), { userId: "u", message: "more", conversationId: id }, emit));
    expect(out.error?.code).toBe("conversation_full");
    expect(calls).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  const limits = { perMinute: 3, perDay: 5 };
  async function sendMessages(store: MemoryAdvisorStore, userId: string, n: number) {
    for (let i = 0; i < n; i++) await store.appendMessage({ conversationId: "c", userId, restaurantId: "r", role: "user", content: "q" });
  }

  it("allows traffic under the per-minute limit and blocks at it", async () => {
    let now = 1_000_000;
    const store = new MemoryAdvisorStore(() => now);
    await sendMessages(store, "u1", 2);
    expect(await checkRateLimit(store, "u1", now, limits)).toEqual({ allowed: true });
    await sendMessages(store, "u1", 1);
    expect(await checkRateLimit(store, "u1", now, limits)).toMatchObject({ allowed: false, reason: "minute" });
  });

  it("frees up again after the window passes", async () => {
    let now = 1_000_000;
    const store = new MemoryAdvisorStore(() => now);
    await sendMessages(store, "u1", 3);
    expect(await checkRateLimit(store, "u1", now, limits)).toMatchObject({ allowed: false });
    now += 61_000;
    expect(await checkRateLimit(store, "u1", now, limits)).toEqual({ allowed: true });
  });

  it("applies a daily cap across the whole day", async () => {
    let now = 1_000_000;
    const store = new MemoryAdvisorStore(() => now);
    for (let i = 0; i < 5; i++) { await sendMessages(store, "u1", 1); now += 10 * 60_000; }
    expect(await checkRateLimit(store, "u1", now, limits)).toMatchObject({ allowed: false, reason: "day" });
  });

  it("counts each user separately", async () => {
    const now = 1_000_000;
    const store = new MemoryAdvisorStore(() => now);
    await sendMessages(store, "noisy", 3);
    expect(await checkRateLimit(store, "noisy", now, limits)).toMatchObject({ allowed: false });
    expect(await checkRateLimit(store, "quiet", now, limits)).toEqual({ allowed: true });
  });

  it("is enforced by the handler: the next message after the limit is rejected before the model is called", async () => {
    let now = 5_000_000;
    const store = new MemoryAdvisorStore(() => now);
    store.memberships.set("u", "rest-a");
    const per = ADVISOR_CONFIG.rateLimit.perMinute;
    const { model, calls } = scriptedModel(Array.from({ length: per + 1 }, () => say("ok")));
    const deps = makeDeps(model, store, () => now);
    for (let i = 0; i < per; i++) {
      const r = await collect((emit) => handleChat(deps, { userId: "u", message: `q${i}` }, emit));
      expect(r.error).toBeUndefined();
    }
    const blocked = await collect((emit) => handleChat(deps, { userId: "u", message: "one too many" }, emit));
    expect(blocked.error).toMatchObject({ code: "rate_limited" });
    expect(blocked.error?.retryAfterSec).toBeGreaterThan(0);
    expect(calls).toHaveLength(per);
    now += 61_000;
    const again = await collect((emit) => handleChat(deps, { userId: "u", message: "ok again" }, emit));
    expect(again.error).toBeUndefined();
  });
});
