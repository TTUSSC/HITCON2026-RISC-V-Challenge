import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  MAX_DISPLAY_NAME_LENGTH,
  clampAttempts,
  parseProgressBody,
  sanitizeDisplayName,
} from "../../src/leaderboard/validate";

const valid = {
  profileId: "3f2a4b6c-1111-2222-3333-444455556666",
  displayName: "阿明",
  entryPoint: "L1",
  levelId: "L2-0",
  attempts: 3,
};

describe("sanitizeDisplayName", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeDisplayName("  阿明  ")).toBe("阿明");
  });

  it("caps the name at the maximum length", () => {
    const long = "a".repeat(100);
    expect(sanitizeDisplayName(long)).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
  });

  it("returns an empty string for a blank name, leaving the caller to reject", () => {
    expect(sanitizeDisplayName("   ")).toBe("");
  });

  it("counts the cap in code points so an emoji is not cut in half", () => {
    // 30 astral-plane characters: a UTF-16 slice(0, 24) would land mid-surrogate
    // and produce a lone surrogate, which is not valid UTF-8.
    const name = "🙂".repeat(30);
    const result = sanitizeDisplayName(name);
    expect([...result]).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
    expect(result).toBe("🙂".repeat(MAX_DISPLAY_NAME_LENGTH));
  });
});

describe("clampAttempts", () => {
  it("defaults a missing count to 1", () => {
    expect(clampAttempts(undefined)).toBe(1);
  });

  it("raises a nonsensical count up to 1", () => {
    expect(clampAttempts(0)).toBe(1);
    expect(clampAttempts(-5)).toBe(1);
  });

  it("caps an absurd count", () => {
    expect(clampAttempts(10_000)).toBe(MAX_ATTEMPTS);
  });

  it("truncates a fractional count", () => {
    expect(clampAttempts(3.7)).toBe(3);
  });
});

describe("parseProgressBody", () => {
  it("accepts a well-formed body and derives the depth server-side", () => {
    const result = parseProgressBody(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.depth).toBe(9);
    expect(result.value.levelId).toBe("L2-0");
    expect(result.value.attempts).toBe(3);
  });

  it("ignores any depth the client tries to supply", () => {
    const result = parseProgressBody({ ...valid, depth: 23 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.depth).toBe(9);
  });

  it("accepts the non-UUID fallback profile id shape", () => {
    const result = parseProgressBody({ ...valid, profileId: "profile-1755740000000-x8f2q1" });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown level id", () => {
    const result = parseProgressBody({ ...valid, levelId: "L9-99" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("L9-99");
  });

  it("rejects an entry point outside the whitelist", () => {
    expect(parseProgressBody({ ...valid, entryPoint: "L3" }).ok).toBe(false);
  });

  it("rejects a profile id with unexpected characters", () => {
    expect(parseProgressBody({ ...valid, profileId: "<script>" }).ok).toBe(false);
  });

  it("rejects an over-long profile id", () => {
    expect(parseProgressBody({ ...valid, profileId: "a".repeat(65) }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseProgressBody(null).ok).toBe(false);
    expect(parseProgressBody("nope").ok).toBe(false);
  });

  it("rejects a missing display name — there is no anonymous player", () => {
    const { displayName, ...withoutName } = valid;
    void displayName;
    const result = parseProgressBody(withoutName);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("displayName");
  });

  it("rejects a whitespace-only display name", () => {
    expect(parseProgressBody({ ...valid, displayName: "   " }).ok).toBe(false);
  });
});
