import { describe, expect, it } from "vitest";
import {
  FALLBACK_DISPLAY_NAME,
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

  it("falls back rather than rejecting an empty name", () => {
    expect(sanitizeDisplayName("   ")).toBe(FALLBACK_DISPLAY_NAME);
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

  it("falls back instead of rejecting when the display name is missing", () => {
    const { displayName, ...withoutName } = valid;
    void displayName;
    const result = parseProgressBody(withoutName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe(FALLBACK_DISPLAY_NAME);
  });
});
