// Fire-and-forget upload of a level pass to the leaderboard backend.
//
// Two rules here are load-bearing for the booth:
//
// 1. Entirely opt-in. With VITE_LEADERBOARD_API unset this module does nothing
//    at all, so merging it cannot change the behaviour of the current
//    deployment. That also side-steps a nasty failure mode: the frontend's
//    catch-all rewrite answers /api/* with index.html and a 200, so a client
//    that posted blind would read a page of HTML as a successful upload.
//
// 2. It must never throw and never block. The pass is already recorded locally
//    and the celebration plays regardless of what the network does.
//
// There is deliberately no retry queue. The leaderboard ranks players by their
// DEEPEST pass, so a dropped upload heals itself — if L1-1 fails to upload but
// L1-2 succeeds, the player's depth is still right. Only losing their very last
// pass costs them anything, which does not justify an outbox.

import type { SessionProgress } from "./types";

// Re-exported rather than redeclared: types.ts is where this union already
// lives, and sessionStore hands submitPass a value of exactly that type. A
// second literal copy in the same package is duplication that can drift.
export type EntryPoint = SessionProgress["entryPoint"];

export interface PassPayload {
  profileId: string;
  displayName: string;
  entryPoint: EntryPoint;
  levelId: string;
  attempts: number;
}

// Read on each call rather than at module load, so a test can stub the
// environment after this module has already been imported.
function apiBase(): string | undefined {
  const value = import.meta.env.VITE_LEADERBOARD_API;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isLeaderboardEnabled(): boolean {
  return apiBase() !== undefined;
}

export async function submitPass(payload: PassPayload): Promise<void> {
  const base = apiBase();
  if (!base) return;

  // No nickname means the player tapped 跳過 on the entry screen's nickname
  // modal, which leaves displayName "". There is no anonymous-player concept
  // here: not naming yourself simply means not joining the leaderboard. Bailing
  // out client-side keeps the server from answering a stream of 400s during
  // completely normal play, which would bury a real problem later.
  if (payload.displayName.trim().length === 0) return;

  try {
    await fetch(`${base.replace(/\/$/, "")}/leaderboard/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Survives the player navigating away the instant they pass.
      keepalive: true,
    });
  } catch {
    // Swallowed by design — see rule 2 above.
  }
}

/** One row of the public leaderboard, as returned by GET /api/leaderboard. */
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  entryPoint: EntryPoint;
  depth: number;
  levelId: string;
  reachedAt: string;
}

// Unlike submitPass, this one DOES reject on failure. The two have opposite
// contracts on purpose: a failed upload must stay invisible so it cannot spoil
// a pass, whereas a failed read has a screen waiting on it and needs to show an
// error rather than an empty board that looks like "nobody has played yet".
export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const base = apiBase();
  if (!base) return [];

  const response = await fetch(
    `${base.replace(/\/$/, "")}/leaderboard?limit=${limit}`,
  );
  if (!response.ok) {
    throw new Error(`leaderboard request failed with ${response.status}`);
  }
  const body = (await response.json()) as { entries?: LeaderboardEntry[] };
  return body.entries ?? [];
}
