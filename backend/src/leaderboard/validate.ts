import { z } from "zod";
import { depthForLevel } from "../shared/levels";

export const ENTRY_POINTS = ["L0", "L1", "L2"] as const;
export type EntryPoint = (typeof ENTRY_POINTS)[number];

export const MAX_DISPLAY_NAME_LENGTH = 24;
export const MAX_ATTEMPTS = 999;

// profileId arrives straight from the browser's localStorage. It is usually a
// crypto.randomUUID(), but frontend/src/engine/profileId.ts falls back to
// `profile-<timestamp>-<random>` where randomUUID is unavailable, so this
// accepts both shapes rather than demanding a UUID.
const PROFILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Trim and cap only. This is NOT content moderation — that is deliberately out
// of scope (see the spec's 不做 table). It exists so an arbitrarily long string
// cannot reach the database. Returns "" for a blank name; the caller rejects
// that, because there is no anonymous-player concept in this system.
//
// Slicing goes through [...raw] so the cap counts code points, not UTF-16 code
// units — a plain .slice(0, 24) can cut an emoji in half and leave a lone
// surrogate, which is not valid UTF-8 and would fail on the way to Postgres.
export function sanitizeDisplayName(raw: string): string {
  return [...raw.trim()].slice(0, MAX_DISPLAY_NAME_LENGTH).join("").trim();
}

export function clampAttempts(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_ATTEMPTS);
}

const progressSchema = z.object({
  profileId: z
    .string()
    .regex(PROFILE_ID_PATTERN, "must be 1-64 characters of [A-Za-z0-9_-]"),
  displayName: z.string().optional(),
  entryPoint: z.enum(ENTRY_POINTS),
  levelId: z.string(),
  attempts: z.number().optional(),
});

export interface ProgressInput {
  profileId: string;
  displayName: string;
  entryPoint: EntryPoint;
  levelId: string;
  depth: number;
  attempts: number;
}

export type ParseResult =
  | { ok: true; value: ProgressInput }
  | { ok: false; error: string };

export function parseProgressBody(body: unknown): ParseResult {
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: detail };
  }

  // Depth is derived here, never read off the request — a client that claims
  // to have cleared L3-Bonus still only scores whatever levelId it names, and
  // an unrecognised levelId is refused outright.
  const depth = depthForLevel(parsed.data.levelId);
  if (depth === undefined) {
    return { ok: false, error: `unknown levelId "${parsed.data.levelId}"` };
  }

  // No nickname, no leaderboard entry. The client already declines to upload in
  // this case (see leaderboardClient.ts), so reaching here means something
  // bypassed it — refuse rather than inventing a placeholder name.
  const displayName = sanitizeDisplayName(parsed.data.displayName ?? "");
  if (displayName.length === 0) {
    return { ok: false, error: "displayName must not be empty" };
  }

  return {
    ok: true,
    value: {
      profileId: parsed.data.profileId,
      displayName,
      entryPoint: parsed.data.entryPoint,
      levelId: parsed.data.levelId,
      depth,
      attempts: clampAttempts(parsed.data.attempts),
    },
  };
}
