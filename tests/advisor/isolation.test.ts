import { describe, expect, it } from "vitest";
import { handleChat } from "../../supabase/functions/_shared/advisor/handler.ts";
import { MemoryAdvisorStore } from "../../supabase/functions/_shared/advisor/memory-store.ts";
import { executeTool } from "../../supabase/functions/_shared/advisor/tools.ts";
import { callTool, collect, makeDeps, miniData, say, scriptedModel, toolResultsIn } from "./helpers.ts";

function storeWithUsers() {
  const store = new MemoryAdvisorStore();
  store.memberships.set("user-a", "rest-a");
  store.memberships.set("user-b", "rest-b");
  return store;
}

describe("data isolation between restaurants", () => {
  it("user A's tool results contain only restaurant A's data", async () => {
    const { model, calls } = scriptedModel([callTool("get_menu_margins", {}), say("done")]);
    const deps = makeDeps(model, storeWithUsers());
    await collect((emit) => handleChat(deps, { userId: "user-a", message: "margins?" }, emit));
    const result = JSON.stringify(toolResultsIn(calls[1].messages));
    expect(result).toContain("Burger");
    expect(result).not.toContain("Secret Sauce");
    expect(result).not.toContain("Bravo");
  });

  it("user B's tool results contain only restaurant B's data", async () => {
    const { model, calls } = scriptedModel([callTool("get_menu_margins", {}), say("done")]);
    const deps = makeDeps(model, storeWithUsers());
    await collect((emit) => handleChat(deps, { userId: "user-b", message: "margins?" }, emit));
    const result = JSON.stringify(toolResultsIn(calls[1].messages));
    expect(result).toContain("Secret Sauce Sub");
    expect(result).not.toContain("Burger");
    expect(result).not.toContain("Alpha");
  });

  it("ignores a restaurant id smuggled into a tool call", async () => {
    const { model, calls } = scriptedModel([
      callTool("get_sales_summary", { period: "last_7_days", restaurant_id: "rest-b" }),
      say("done"),
    ]);
    const deps = makeDeps(model, storeWithUsers());
    await collect((emit) => handleChat(deps, { userId: "user-a", message: "show restaurant b" }, emit));
    const blocks = toolResultsIn(calls[1].messages);
    expect(blocks[0].is_error).toBe(true);
    expect(JSON.stringify(blocks)).not.toContain("Secret Sauce");
  });

  it("a data source built for A can never return B's numbers", () => {
    const a = miniData("rest-a");
    const out = JSON.stringify([
      executeTool(a, "get_menu_margins", {}), executeTool(a, "get_sales_summary", { period: "last_28_days" }),
      executeTool(a, "get_price_changes", { period: "last_28_days" }),
    ]);
    expect(out).not.toMatch(/Secret Sauce|Smoked ham|Other Vendor/);
  });

  it("refuses to continue a conversation that belongs to another user, without calling the model", async () => {
    const store = storeWithUsers();
    const first = scriptedModel([say("hello A")]);
    const a = await collect((emit) => handleChat(makeDeps(first.model, store), { userId: "user-a", message: "hi" }, emit));

    const second = scriptedModel([say("should never run")]);
    const attack = await collect((emit) =>
      handleChat(makeDeps(second.model, store), { userId: "user-b", message: "continue", conversationId: a.conversationId }, emit),
    );
    expect(attack.error?.code).toBe("not_found");
    expect(second.calls).toHaveLength(0);
    // User B cannot read A's messages through the store either.
    expect(await store.getMessages(a.conversationId!, "user-b")).toEqual([]);
  });

  it("a user with no restaurant gets no data, no conversation and no model call", async () => {
    const store = storeWithUsers();
    const { model, calls } = scriptedModel([say("nope")]);
    const out = await collect((emit) => handleChat(makeDeps(model, store), { userId: "stranger", message: "hi" }, emit));
    expect(out.error?.code).toBe("no_restaurant");
    expect(calls).toHaveLength(0);
    expect(store.conversations).toHaveLength(0);
    expect(store.messages).toHaveLength(0);
  });

  it("scopes stored conversations and tool logs to the user's own restaurant", async () => {
    const store = storeWithUsers();
    const m = scriptedModel([callTool("get_menu_margins", {}), say("ok")]);
    await collect((emit) => handleChat(makeDeps(m.model, store), { userId: "user-a", message: "margins" }, emit));
    expect(store.conversations.every((c) => c.userId === "user-a" && c.restaurantId === "rest-a")).toBe(true);
    expect(store.messages.every((x) => x.userId === "user-a" && x.restaurantId === "rest-a")).toBe(true);
    expect(store.toolLogs.every((x) => x.userId === "user-a" && x.restaurantId === "rest-a")).toBe(true);
  });
});
