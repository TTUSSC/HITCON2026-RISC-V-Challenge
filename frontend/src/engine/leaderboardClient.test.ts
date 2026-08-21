import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLeaderboard, isLeaderboardEnabled, submitPass } from "./leaderboardClient";

const payload = {
  profileId: "3f2a4b6c-1111-2222-3333-444455556666",
  displayName: "阿明",
  entryPoint: "L1" as const,
  levelId: "L2-0",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("when VITE_LEADERBOARD_API is not configured", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_LEADERBOARD_API", "");
  });

  it("reports the feature as disabled", () => {
    expect(isLeaderboardEnabled()).toBe(false);
  });

  it("sends nothing at all", async () => {
    await submitPass(payload);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("when VITE_LEADERBOARD_API is configured", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_LEADERBOARD_API", "/api");
  });

  it("reports the feature as enabled", () => {
    expect(isLeaderboardEnabled()).toBe(true);
  });

  it("posts the payload to the progress endpoint", async () => {
    await submitPass(payload);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/leaderboard/progress");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it("strips a trailing slash from the configured base", async () => {
    vi.stubEnv("VITE_LEADERBOARD_API", "https://api.example.com/");
    await submitPass(payload);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.example.com/leaderboard/progress");
  });

  it("sends nothing when the player skipped the nickname", async () => {
    await submitPass({ ...payload, displayName: "" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends nothing when the nickname is only whitespace", async () => {
    await submitPass({ ...payload, displayName: "   " });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not throw when the network fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await expect(submitPass(payload)).resolves.toBeUndefined();
  });

  it("does not throw when the server returns an error status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(submitPass(payload)).resolves.toBeUndefined();
  });

  it("requests the leaderboard with no limit param when called with no argument, letting the server decide", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ entries: [] }),
    } as Response);
    await fetchLeaderboard();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/leaderboard");
    expect(String(url)).not.toContain("limit=");
  });

  it("requests a specific limit when one is passed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ entries: [] }),
    } as Response);
    await fetchLeaderboard(10);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("limit=10");
  });

  it("returns the entries array from the response body", async () => {
    const entries = [
      {
        rank: 1,
        displayName: "阿明",
        entryPoint: "L1" as const,
        depth: 9,
        levelId: "L2-0",
        reachedAt: "2026-08-21T10:00:00.000Z",
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ entries }),
    } as Response);
    await expect(fetchLeaderboard()).resolves.toEqual(entries);
  });

  it("rejects when the server responds with a non-2xx status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(fetchLeaderboard()).rejects.toThrow();
  });
});
