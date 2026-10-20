import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline, toolLabel } from "../../src/advisor/format.ts";
import { createSseParser } from "../../src/advisor/sse.ts";
import type { AdvisorEvent } from "../../supabase/functions/_shared/advisor/handler.ts";

describe("SSE parser", () => {
  const collect = () => {
    const events: AdvisorEvent[] = [];
    return { events, parser: createSseParser((e) => events.push(e)) };
  };
  const frame = (e: AdvisorEvent) => `data: ${JSON.stringify(e)}\n\n`;

  it("parses whole events", () => {
    const { events, parser } = collect();
    parser.push(frame({ type: "meta", conversationId: "c1" }) + frame({ type: "text", text: "Hi" }));
    expect(events).toEqual([{ type: "meta", conversationId: "c1" }, { type: "text", text: "Hi" }]);
  });

  it("reassembles an event split across chunks, even mid-JSON", () => {
    const { events, parser } = collect();
    const raw = frame({ type: "text", text: "Hello world" });
    parser.push(raw.slice(0, 12));
    expect(events).toHaveLength(0);
    parser.push(raw.slice(12, 25));
    parser.push(raw.slice(25));
    expect(events).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("skips malformed events and keeps going", () => {
    const { events, parser } = collect();
    parser.push("data: {not json}\n\n" + frame({ type: "done" }));
    expect(events).toEqual([{ type: "done" }]);
  });

  it("keeps newlines and unicode inside text", () => {
    const { events, parser } = collect();
    parser.push(frame({ type: "text", text: "Line 1\n\nLine 2 – 35.8%" }));
    expect(events[0]).toEqual({ type: "text", text: "Line 1\n\nLine 2 – 35.8%" });
  });
});

describe("answer formatting", () => {
  it("splits paragraphs and lists", () => {
    const blocks = parseBlocks("Lead with the answer.\n\n- First\n- Second\n\n1. Step one\n2. Step two");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol"]);
    expect(blocks[1]).toMatchObject({ type: "ul" });
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("renders **bold** runs and leaves everything else as plain text", () => {
    expect(parseInline("Food cost is **35.8%** this week")).toEqual([
      { text: "Food cost is ", bold: false }, { text: "35.8%", bold: true }, { text: " this week", bold: false },
    ]);
  });

  it("never turns model output into markup: HTML stays literal text", () => {
    const blocks = parseBlocks('<img src=x onerror=alert(1)> and <script>alert(1)</script>');
    expect(JSON.stringify(blocks)).toContain("<script>"); // kept as text; React escapes it on render
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("p");
  });

  it("handles empty and streaming-partial text", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("**half bold")).toEqual([{ type: "p", inline: [{ text: "**half bold", bold: false }] }]);
  });

  it("labels known tools and falls back for unknown ones", () => {
    expect(toolLabel("get_food_cost")).toBe("Checking food cost");
    expect(toolLabel("something_new")).toBe("Looking up your data");
  });
});
