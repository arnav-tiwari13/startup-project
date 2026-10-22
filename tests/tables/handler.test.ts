import { describe, expect, it, vi } from "vitest";
import { handleTableData, MAX_BODY_BYTES, type TableDataDeps } from "../../supabase/functions/_shared/tables/handler.ts";
import { A, B, TODAY, bundleFrom } from "./helpers.ts";

function deps(over: Partial<TableDataDeps> = {}) {
  const load = vi.fn<TableDataDeps["load"]>(async () => bundleFrom());
  const d: TableDataDeps = {
    userId: async () => "user-a",
    memberships: async () => [A],
    load,
    today: () => TODAY,
    ...over,
  };
  return { d, load };
}
const body = (o: object) => JSON.stringify({ tableId: "menu_margins", period: { preset: "last_week" }, ...o });

describe("table-data handler", () => {
  it("401 without a verified user, and does not touch the database", async () => {
    const { d, load } = deps({ userId: async () => null });
    expect((await handleTableData(d, body({}))).status).toBe(401);
    expect(load).not.toHaveBeenCalled();
  });

  it("400 for malformed JSON, unknown fields and bad values, never echoing submitted values", async () => {
    const { d } = deps();
    expect((await handleTableData(d, "{nope")).status).toBe(400);
    const bad = await handleTableData(d, body({ limit: 9999, secret: "hunter2" }));
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).not.toContain("hunter2");
    expect((await handleTableData(d, body({ period: { preset: "custom", start: "2026-13-01", end: "2026-13-02" } }))).status).toBe(400);
  });

  it("413 for an oversized body", async () => {
    const { d } = deps();
    expect((await handleTableData(d, "x".repeat(MAX_BODY_BYTES + 1))).status).toBe(413);
  });

  it("400 for a period or grouping the table cannot use", async () => {
    const { d } = deps();
    expect((await handleTableData(d, body({ period: { preset: "custom" } }))).body).toEqual({ error: "bad_period" });
    expect((await handleTableData(d, body({ groupBy: "vendor" }))).body).toEqual({ error: "bad_group" });
  });

  it("403 when asking for a restaurant the user does not belong to, and loads nothing", async () => {
    const { d, load } = deps();
    const res = await handleTableData(d, body({ restaurantIds: [B] }));
    expect(res).toEqual({ status: 403, body: { error: "forbidden" } });
    expect(load).not.toHaveBeenCalled();
  });

  it("loads only the user's own restaurants when none are named", async () => {
    const { d, load } = deps({ memberships: async () => [A] });
    const res = await handleTableData(d, body({}));
    expect(res.status).toBe(200);
    expect(load).toHaveBeenCalledWith("user-a", [A], expect.anything());
  });

  it("the user comes from auth: a userId in the body is rejected, and loads use the verified id", async () => {
    const { d, load } = deps();
    expect((await handleTableData(d, body({ userId: "user-b" }))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
    await handleTableData(d, body({}));
    expect(load.mock.calls.every((call) => call[0] === "user-a")).toBe(true);
  });

  it("a user with no restaurants gets an empty table without querying anything", async () => {
    const { d, load } = deps({ memberships: async () => [] });
    const res = await handleTableData(d, body({}));
    expect(res.status).toBe(200);
    expect((res.body as { rows: unknown[] }).rows).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it("returns rows for valid requests, even when the loaded data also contains another restaurant", async () => {
    const { d } = deps({ memberships: async () => [A] });
    const res = await handleTableData(d, body({ tableId: "profit_snapshot" }));
    const rows = (res.body as { rows: { key: string }[] }).rows;
    expect(rows.map((r) => r.key)).toEqual([A]);
  });
});
