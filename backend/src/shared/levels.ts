// The canonical 23-level chain, mirroring frontend/src/engine/levels.ts's
// `levels` array order. A player's leaderboard score is the 1-based position
// of the furthest level they have passed — which is what makes the three
// entry points comparable without any hand-tuned weighting: L2-0 sits at
// position 9, so an L2 entrant who clears it ties an L0 entrant who ground
// through eight levels to reach the same place.
//
// This list is duplicated rather than imported because frontend and backend
// deploy as separate Vercel projects. test/shared/levelOrder.drift.test.ts
// imports the frontend module directly and fails if the two ever disagree.

export const LEVEL_ORDER = [
  "L0-1",
  "L0-2",
  "L0-3",
  "L0-4",
  "L1-1",
  "L1-2",
  "L1-3",
  "L1-4",
  "L2-0",
  "L2-1",
  "L2-2",
  "L2-3",
  "L2-4",
  "L2-5a",
  "L2-5b",
  "L2-5c",
  "L2-Bonus",
  "L3-0",
  "L3-1",
  "L3-2",
  "L3-3",
  "L3-4",
  "L3-Bonus",
] as const;

export type LevelId = (typeof LEVEL_ORDER)[number];

export const MAX_DEPTH = LEVEL_ORDER.length;

/** 1-based position in the chain; undefined for an unknown level id. */
export function depthForLevel(levelId: string): number | undefined {
  const index = (LEVEL_ORDER as readonly string[]).indexOf(levelId);
  return index === -1 ? undefined : index + 1;
}
