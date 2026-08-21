import { describe, expect, it } from "vitest";
import { LEVEL_ORDER, MAX_DEPTH, depthForLevel } from "../../src/shared/levels";

describe("depthForLevel", () => {
  it("puts the first level at depth 1", () => {
    expect(depthForLevel("L0-1")).toBe(1);
  });

  it("puts L2-0 at depth 9 so the L2 entry point ties a full L0 run", () => {
    expect(depthForLevel("L2-0")).toBe(9);
  });

  it("puts the final level at MAX_DEPTH", () => {
    expect(depthForLevel("L3-Bonus")).toBe(MAX_DEPTH);
  });

  it("returns undefined for an unknown level id", () => {
    expect(depthForLevel("L9-99")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(depthForLevel("")).toBeUndefined();
  });
});

describe("LEVEL_ORDER", () => {
  it("has 23 levels", () => {
    expect(MAX_DEPTH).toBe(23);
  });

  it("contains no duplicate ids", () => {
    expect(new Set(LEVEL_ORDER).size).toBe(LEVEL_ORDER.length);
  });
});
