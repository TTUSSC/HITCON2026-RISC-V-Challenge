import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

vi.mock("../../src/leaderboard/queries", () => ({
  recordProgress: vi.fn(),
  fetchBestPasses: vi.fn(),
}));

import progressHandler from "../../api/leaderboard/progress";
import leaderboardHandler from "../../api/leaderboard/index";
import { fetchBestPasses, recordProgress } from "../../src/leaderboard/queries";
import { MAX_LIMIT } from "../../src/leaderboard/ranking";

interface FakeRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  ended: boolean;
  setHeader(key: string, value: string): FakeRes;
  status(code: number): FakeRes;
  json(payload: unknown): FakeRes;
  end(): FakeRes;
}

function createRes(): FakeRes {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function req(overrides: Partial<VercelRequest>): VercelRequest {
  return { method: "POST", query: {}, body: undefined, ...overrides } as VercelRequest;
}

const validBody = {
  profileId: "3f2a4b6c-1111-2222-3333-444455556666",
  displayName: "阿明",
  entryPoint: "L1",
  levelId: "L2-0",
  attempts: 2,
};

beforeEach(() => {
  vi.mocked(recordProgress).mockReset();
  vi.mocked(fetchBestPasses).mockReset();
});

describe("POST /api/leaderboard/progress", () => {
  it("stores a valid pass and echoes the server-derived depth", async () => {
    const res = createRes();
    await progressHandler(req({ body: validBody }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, depth: 9 });
    expect(recordProgress).toHaveBeenCalledOnce();
  });

  it("refuses a GET", async () => {
    const res = createRes();
    await progressHandler(req({ method: "GET" }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(405);
    expect(recordProgress).not.toHaveBeenCalled();
  });

  it("answers a CORS preflight without touching the database", async () => {
    const res = createRes();
    await progressHandler(req({ method: "OPTIONS" }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(recordProgress).not.toHaveBeenCalled();
  });

  it("rejects an unknown level id without touching the database", async () => {
    const res = createRes();
    await progressHandler(
      req({ body: { ...validBody, levelId: "L9-99" } }),
      res as unknown as VercelResponse,
    );
    expect(res.statusCode).toBe(400);
    expect(recordProgress).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking the underlying error", async () => {
    vi.mocked(recordProgress).mockRejectedValueOnce(new Error("connection refused"));
    const res = createRes();
    await progressHandler(req({ body: validBody }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("connection refused");
  });
});

describe("GET /api/leaderboard", () => {
  it("returns ranked entries", async () => {
    vi.mocked(fetchBestPasses).mockResolvedValueOnce([
      {
        displayName: "阿明",
        entryPoint: "L1",
        depth: 9,
        levelId: "L2-0",
        passedAt: new Date("2026-08-21T10:00:00.000Z"),
      },
    ]);
    const res = createRes();
    await leaderboardHandler(
      req({ method: "GET" }),
      res as unknown as VercelResponse,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { entries: Array<Record<string, unknown>> };
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[0]).not.toHaveProperty("profileId");
  });

  it("clamps an absurd limit before querying", async () => {
    vi.mocked(fetchBestPasses).mockResolvedValueOnce([]);
    const res = createRes();
    await leaderboardHandler(
      req({ method: "GET", query: { limit: "99999" } }),
      res as unknown as VercelResponse,
    );
    expect(fetchBestPasses).toHaveBeenCalledWith(MAX_LIMIT);
  });

  it("refuses a POST", async () => {
    const res = createRes();
    await leaderboardHandler(req({ method: "POST" }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(405);
  });
});
