import type { EntryPoint } from "./validate";

/** One player's furthest pass, as read out of the database. */
export interface BestPassRow {
  displayName: string;
  entryPoint: EntryPoint;
  depth: number;
  levelId: string;
  passedAt: Date;
}

/** One row of the public leaderboard. Deliberately carries no profileId. */
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  entryPoint: EntryPoint;
  depth: number;
  levelId: string;
  reachedAt: string;
}

export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 1000;

export function parseLimit(raw: unknown): number {
  if (typeof raw === "string") {
    if (raw.trim() === "") return DEFAULT_LIMIT;
    const value = Number(raw);
    if (!Number.isFinite(value)) return DEFAULT_LIMIT;
    return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
    return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT);
  }
  return DEFAULT_LIMIT;
}

// The SQL already returns rows in this order; sorting again here keeps rank
// assignment correct for any caller and makes the ordering rule testable
// without a database. Copies first so the caller's array is left alone.
export function rankEntries(rows: readonly BestPassRow[]): LeaderboardEntry[] {
  return [...rows]
    .sort((a, b) => b.depth - a.depth || a.passedAt.getTime() - b.passedAt.getTime())
    .map((row, index) => ({
      rank: index + 1,
      displayName: row.displayName,
      entryPoint: row.entryPoint,
      depth: row.depth,
      levelId: row.levelId,
      reachedAt: row.passedAt.toISOString(),
    }));
}
