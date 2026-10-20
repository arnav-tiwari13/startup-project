import { describe, expect, it, vi } from "vitest";
import { REFUSAL_TEXT, runAdvisorTurn } from "../../supabase/functions/_shared/advisor/agent.ts";
import { ADVISOR_CONFIG, resolveModelSettings } from "../../supabase/functions/_shared/advisor/config.ts";
import { handleChat } from "../../supabase/functions/_shared/advisor/handler.ts";
import { MemoryAdvisorStore } from "../../supabase/functions/_shared/advisor/memory-store.ts";
import { buildSystemPrompt, PROMPT_CANARY } from "../../supabase/functions/_shared/advisor/system-prompt.ts";
import { TOOL_DEFINITIONS } from "../../supabase/functions/_shared/advisor/tools.ts";
import { callTool, collect, makeDeps, miniData, say, scriptedModel, toolResultsIn } from "./helpers.ts";

const run = (script: Parameters<typeof scriptedModel>[0], extra: { maxIterations?: number } = {}) => {
  const m = scriptedModel(script);
  const texts: string[] = [];
  const promise = runAdvisorTurn({
    model: m.model, system: "S", tools: TOOL_DEFINITIONS, data: miniData("rest-a"),
    history: [{ role: "user", content: "hi" }], maxIterations: extra.maxIterations ?? 6, onText: (t) => texts.push(t),
  });
  return { ...m, texts, promise };
};

describe("tool loop", () => {
  it("runs a requested tool, feeds the result back and returns the final answer", async () => {
    const r = run([callTool("get_food_cost", { period: "last_7_days" }), say("Food cost is 37.6%.")]);
    const out = await r.promise;
    expect(out.text).toBe("Food cost is 37.6%.");
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0]).toMatchObject({ name: "get_food_cost", ok: true });
    const result = toolResultsIn(r.calls[1].messages)[0];
    expect(JSON.parse(String(result.content)).food_cost_pct).toBe(37.6);
    expect(result.is_error).toBe(false);
  });

  it("returns an error result to the model for an unknown tool or bad input, and lets it recover", async () => {
    const r = run([callTool("hack_database", {}), callTool("get_food_cost", { period: "forever" }, "tu_2"), say("Sorry, I couldn't fetch that.")]);
    const out = await r.promise;
    expect(out.toolCalls.map((c) => c.ok)).toEqual([false, false]);
    expect(toolResultsIn(r.calls[1].messages)[0].is_error).toBe(true);
    expect(out.text).toContain("couldn't fetch");
  });

  it("stops after the maximum number of tool round trips", async () => {
    const r = run(Array.from({ length: 5 }, (_, i) => callTool("get_menu_margins", {}, `tu_${i}`)), { maxIterations: 3 });
    const out = await r.promise;
    expect(out.stopReason).toBe("max_iterations");
    expect(r.calls).toHaveLength(3);
    expect(out.text).toMatch(/narrower/i);
  });

  it("handles a refusal without reading content", async () => {
    const out = await run([{ content: [], stop_reason: "refusal" }]).promise;
    expect(out).toMatchObject({ stopReason: "refusal", text: REFUSAL_TEXT });
  });

  it("separates text from different model calls with a blank line", async () => {
    const r = run([
      { content: [{ type: "text", text: "Let me check." }, { type: "tool_use", id: "t", name: "get_menu_margins", input: {} }], stop_reason: "tool_use" },
      say("Here you go."),
    ]);
    expect((await r.promise).text).toBe("Let me check.\n\nHere you go.");
  });
});

describe("handler", () => {
  const setup = () => {
    const store = new MemoryAdvisorStore();
    store.memberships.set("u", "rest-a");
    return store;
  };

  it("streams events in order, persists both messages and logs tool calls", async () => {
    const store = setup();
    const { model } = scriptedModel([callTool("get_sales_summary", { period: "last_7_days" }), say("Sales were $840.")]);
    const out = await collect((emit) => handleChat(makeDeps(model, store), { userId: "u", message: "sales?" }, emit));
    expect(out.events.map((e) => e.type)).toEqual(["meta", "tool", "text", "done"]);
    expect(out.tools).toEqual(["get_sales_summary"]);
    expect(store.messages.map((m) => [m.role, m.content])).toEqual([["user", "sales?"], ["assistant", "Sales were $840."]]);
    expect(store.toolLogs).toHaveLength(1);
    expect(store.toolLogs[0]).toMatchObject({ toolName: "get_sales_summary", ok: true, input: { period: "last_7_days" } });
  });

  it("includes earlier turns of the same conversation", async () => {
    const store = setup();
    const first = scriptedModel([say("A1")]);
    const a = await collect((emit) => handleChat(makeDeps(first.model, store), { userId: "u", message: "Q1" }, emit));
    const second = scriptedModel([say("A2")]);
    await collect((emit) => handleChat(makeDeps(second.model, store, () => Date.now() + 120_000), { userId: "u", message: "Q2", conversationId: a.conversationId }, emit));
    expect(second.calls[0].messages.map((m) => m.content)).toEqual(["Q1", "A1", "Q2"]);
  });

  it("sends the configured system prompt and the five tool definitions", async () => {
    const { model, calls } = scriptedModel([say("ok")]);
    await collect((emit) => handleChat({ ...makeDeps(model, setup()), systemPrompt: buildSystemPrompt("platecfo") }, { userId: "u", message: "hi" }, emit));
    expect(calls[0].system).toContain("platecfo's business advisor");
    expect(calls[0].system).toContain(PROMPT_CANARY);
  });

  it("returns a generic error and never leaks provider details or secrets", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = setup();
    const model = { stream: async () => { throw Object.assign(new Error("401 invalid x-api-key sk-ant-SECRET123"), { name: "AuthenticationError" }); } };
    const out = await collect((emit) => handleChat(makeDeps(model, store), { userId: "u", message: "hi" }, emit));
    expect(out.error?.code).toBe("model_error");
    expect(JSON.stringify(out.events)).not.toContain("sk-ant");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("sk-ant");
    expect(JSON.stringify([store.messages, store.toolLogs])).not.toContain("sk-ant");
    spy.mockRestore();
  });
});

describe("configuration", () => {
  it("takes the model name from config, with an environment override", () => {
    expect(resolveModelSettings({}).model).toBe(ADVISOR_CONFIG.defaultModel);
    expect(resolveModelSettings({ ANTHROPIC_MODEL: "claude-sonnet-5-5" }).model).toBe("claude-sonnet-5-5");
    expect(resolveModelSettings({ ANTHROPIC_MODEL: "  " }).model).toBe(ADVISOR_CONFIG.defaultModel);
  });
  it("validates effort and fallbacks overrides", () => {
    expect(resolveModelSettings({ ANTHROPIC_EFFORT: "turbo" }).effort).toBe(ADVISOR_CONFIG.defaultEffort);
    expect(resolveModelSettings({ ANTHROPIC_EFFORT: "high" }).effort).toBe("high");
    expect(resolveModelSettings({ ANTHROPIC_FALLBACKS: "off" }).fallbacks).toBe(false);
    expect(resolveModelSettings({}).fallbacks).toBe(true);
  });
});
