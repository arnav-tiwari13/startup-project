import type { ApiMessage, ContentBlock, ModelClient, ModelResponse } from "../../supabase/functions/_shared/advisor/agent.ts";
import { DatasetRestaurantData } from "../../supabase/functions/_shared/advisor/dataset-data.ts";
import type { DataSourceFactory } from "../../supabase/functions/_shared/advisor/data-source.ts";
import { MemoryAdvisorStore } from "../../supabase/functions/_shared/advisor/memory-store.ts";
import type { AdvisorEvent, HandlerDeps } from "../../supabase/functions/_shared/advisor/handler.ts";
import type { RestaurantDataset } from "../../supabase/functions/_shared/advisor/types.ts";

/**
 * Tiny dataset with hand-checkable answers. Seven days of sales, 2026-01-09..2026-01-15.
 * Burger: $10, 0.5 lb beef + 1 bun. Slider: $4, 0.2 lb beef + 1 bun. Beef $5.00 until 01-09, $6.00 from 01-10. Bun $0.50.
 * Daily: 10 burgers + 5 sliders = $120 sales, 6 lb beef, 15 buns. Counted usage for the week: beef 45 lb, buns 105.
 */
export const MINI_A: RestaurantDataset = (() => {
  const dates = ["2026-01-09", "2026-01-10", "2026-01-11", "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15"];
  return {
    restaurantId: "rest-a",
    name: "Alpha Burgers",
    asOf: "2026-01-15",
    ingredients: [
      { id: "beef", name: "Ground beef", unit: "lb", vendor: "Acme Meats" },
      { id: "bun", name: "Bun", unit: "each", vendor: "Corner Bakery" },
    ],
    prices: [
      { ingredientId: "beef", date: "2025-12-01", unitCost: 5 },
      { ingredientId: "beef", date: "2026-01-10", unitCost: 6 },
      { ingredientId: "bun", date: "2025-12-01", unitCost: 0.5 },
    ],
    menu: [
      { id: "burger", name: "Burger", price: 10, recipe: [{ ingredientId: "beef", qty: 0.5 }, { ingredientId: "bun", qty: 1 }] },
      { id: "slider", name: "Slider", price: 4, recipe: [{ ingredientId: "beef", qty: 0.2 }, { ingredientId: "bun", qty: 1 }] },
    ],
    sales: dates.flatMap((date) => [
      { date, itemId: "burger", units: 10 },
      { date, itemId: "slider", units: 5 },
    ]),
    usage: [
      { ingredientId: "beef", start: "2026-01-09", end: "2026-01-15", actualUsed: 45 },
      { ingredientId: "bun", start: "2026-01-09", end: "2026-01-15", actualUsed: 105 },
    ],
  };
})();

/** A second business with different items, used to prove data never crosses over. */
export const MINI_B: RestaurantDataset = {
  restaurantId: "rest-b",
  name: "Bravo Subs",
  asOf: "2026-01-15",
  ingredients: [{ id: "ham", name: "Smoked ham", unit: "lb", vendor: "Other Vendor" }],
  prices: [{ ingredientId: "ham", date: "2025-12-01", unitCost: 7 }],
  menu: [{ id: "secret", name: "Secret Sauce Sub", price: 12, recipe: [{ ingredientId: "ham", qty: 0.4 }] }],
  sales: [{ date: "2026-01-15", itemId: "secret", units: 20 }],
  usage: [],
};

export const DATASETS: Record<string, RestaurantDataset> = { "rest-a": MINI_A, "rest-b": MINI_B };
export const miniData = (id: string) => new DatasetRestaurantData(DATASETS[id]);
export const miniFactory: DataSourceFactory = (id) => miniData(id);

type Params = { system: string; messages: ApiMessage[] };
export type Scripted = ModelResponse | ((p: Params) => ModelResponse);

export const say = (text: string): ModelResponse => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });
export const callTool = (name: string, input: unknown, id = "tu_1"): ModelResponse => ({
  content: [{ type: "tool_use", id, name, input }],
  stop_reason: "tool_use",
});

/** A model that replays scripted responses and records every request it receives. */
export function scriptedModel(script: Scripted[]) {
  const calls: Params[] = [];
  const model: ModelClient = {
    async stream(params, onText) {
      calls.push({ system: params.system, messages: structuredClone(params.messages) });
      const next = script[calls.length - 1];
      if (!next) throw new Error("scriptedModel: no more responses");
      const resp = typeof next === "function" ? next(params) : next;
      for (const b of resp.content) if (b.type === "text") onText(String(b.text));
      return resp;
    },
  };
  return { model, calls };
}

export function makeDeps(model: ModelClient, store = new MemoryAdvisorStore(), now = () => Date.now()): HandlerDeps & { store: MemoryAdvisorStore } {
  return { store, model, getData: miniFactory, systemPrompt: "SYSTEM", now };
}

export async function collect(run: (emit: (e: AdvisorEvent) => void) => Promise<void>) {
  const events: AdvisorEvent[] = [];
  await run((e) => events.push(e));
  return {
    events,
    text: events.filter((e): e is Extract<AdvisorEvent, { type: "text" }> => e.type === "text").map((e) => e.text).join(""),
    tools: events.filter((e): e is Extract<AdvisorEvent, { type: "tool" }> => e.type === "tool").map((e) => e.name),
    error: events.find((e): e is Extract<AdvisorEvent, { type: "error" }> => e.type === "error"),
    conversationId: events.find((e): e is Extract<AdvisorEvent, { type: "meta" }> => e.type === "meta")?.conversationId,
  };
}

export const toolResultsIn = (messages: ApiMessage[]): ContentBlock[] =>
  messages.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result") : []));
