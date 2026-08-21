import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parseLimit,
  rankEntries,
  type BestPassRow,
} from "../../src/leaderboard/ranking";

function row(overrides: Partial<BestPassRow> = {}): BestPassRow {
  return {
    displayName: "player",
    entryPoint: "L0",
    depth: 5,
    levelId: "L1-1",
    passedAt: new Date("2026-08-21T10:00:00.000Z"),
    ...overrides,
  };
}

describe("parseLimit", () => {
  it("defaults when the value is absent or unparseable", () => {
    expect(parseLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(parseLimit("abc")).toBe(DEFAULT_LIMIT);
  });

  it("defaults for empty or whitespace-only strings", () => {
    expect(parseLimit("")).toBe(DEFAULT_LIMIT);
    expect(parseLimit("  ")).toBe(DEFAULT_LIMIT);
  });

  it("accepts a numeric string from the query string", () => {
    expect(parseLimit("10")).toBe(10);
  });

  it("clamps to the allowed range", () => {
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("99999")).toBe(MAX_LIMIT);
  });

  it("defaults when given an array (query string repetition)", () => {
    expect(parseLimit(["1", "2"])).toBe(DEFAULT_LIMIT);
  });
});

describe("rankEntries", () => {
  it("orders by depth, deepest first", () => {
    const ranked = rankEntries([
      row({ displayName: "shallow", depth: 3 }),
      row({ displayName: "deep", depth: 20 }),
      row({ displayName: "middle", depth: 9 }),
    ]);
    expect(ranked.map((e) => e.displayName)).toEqual(["deep", "middle", "shallow"]);
  });

  it("breaks a depth tie in favour of whoever got there first", () => {
    const ranked = rankEntries([
      row({ displayName: "later", depth: 9, passedAt: new Date("2026-08-21T12:00:00.000Z") }),
      row({ displayName: "earlier", depth: 9, passedAt: new Date("2026-08-21T09:00:00.000Z") }),
    ]);
    expect(ranked.map((e) => e.displayName)).toEqual(["earlier", "later"]);
  });

  it("numbers ranks from 1", () => {
    const ranked = rankEntries([row({ depth: 9 }), row({ depth: 3 })]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2]);
  });

  it("serialises the timestamp as ISO 8601", () => {
    const [entry] = rankEntries([row()]);
    expect(entry.reachedAt).toBe("2026-08-21T10:00:00.000Z");
  });

  it("never leaks a profileId into the response", () => {
    const withExtra = { ...row(), profileId: "should-not-appear" } as BestPassRow;
    const [entry] = rankEntries([withExtra]);
    expect(entry).not.toHaveProperty("profileId");
  });

  it("returns an empty array for no rows", () => {
    expect(rankEntries([])).toEqual([]);
  });

  it("does not mutate the caller's array", () => {
    const rows = [row({ depth: 3 }), row({ depth: 9 })];
    rankEntries(rows);
    expect(rows.map((r) => r.depth)).toEqual([3, 9]);
  });
});
