import { describe, expect, it } from "vitest";
import { cleanTitle, groupByRecency, titleFrom } from "../../src/advisor/history";

describe("titleFrom", () => {
  it("uses the first question on one line", () => {
    expect(titleFrom("  What was my\n food cost? ")).toBe("What was my food cost?");
  });
  it("truncates long questions with an ellipsis", () => {
    const t = titleFrom("x".repeat(200));
    expect(t.length).toBe(60);
    expect(t.endsWith("…")).toBe(true);
  });
  it("falls back when there is no question", () => {
    expect(titleFrom(undefined)).toBe("New conversation");
    expect(titleFrom("   ")).toBe("New conversation");
  });
});

describe("groupByRecency", () => {
  const now = new Date(2026, 9, 23, 15, 0, 0); // local Oct 23, 3pm
  const local = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();

  it("buckets by local day and drops empty groups", () => {
    const items = [
      { id: "a", createdAt: local(23), title: "a" },
      { id: "b", createdAt: local(22, 23), title: "b" },
      { id: "c", createdAt: local(18), title: "c" },
      { id: "d", createdAt: local(1), title: "d" },
    ];
    const groups = groupByRecency(items, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Previous 7 days", "Older"]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("returns no groups for no conversations", () => {
    expect(groupByRecency([], now)).toEqual([]);
  });
});

describe("cleanTitle", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanTitle("  Brisket \n costs  ")).toBe("Brisket costs");
  });
  it("rejects empty and over-long titles", () => {
    expect(cleanTitle("   ")).toBeNull();
    expect(cleanTitle("x".repeat(101))).toBeNull();
    expect(cleanTitle("x".repeat(100))).toBe("x".repeat(100));
  });
});
