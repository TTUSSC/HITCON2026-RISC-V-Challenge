// Shared "is this level currently reachable" gating logic — factored out so
// MapPage/PathMap's branch-progression display and LevelPage's route guard
// (direct URL access, e.g. typing /level/L3-Bonus with zero progress) both
// derive reachability from the exact same rule instead of two copies
// drifting apart. See LevelPage.tsx's file header for why this exists: a
// hacker poking at the app via URL manipulation shouldn't be able to skip
// the chain just because LevelPage itself never checked anything.
//
// Gating rule (mirrors PathMap.tsx's per-branch "linear gating" comment):
// within a branch's ordered level-id list, a level is reachable iff it's
// already passed, OR it is the first not-yet-passed level in that list.
// Everything after the first not-yet-passed level is locked.

import type { SessionProgress } from "./types";
import { branchLevelIds, branchKeyForLevel } from "./levels";

export function getPassedIds(events: SessionProgress["events"]): Set<string> {
  return new Set(
    events.filter((e) => e.passedAt !== undefined).map((e) => e.levelId),
  );
}

/**
 * Whether `levelId` is currently reachable given the player's real progress:
 * already passed, or the first not-yet-passed level within its own branch's
 * ordered id list. Unknown level ids (not in any branch) are never
 * reachable.
 */
export function isLevelReachable(
  levelId: string,
  events: SessionProgress["events"],
): boolean {
  const branchKey = branchKeyForLevel(levelId);
  if (!branchKey) return false;

  const passedIds = getPassedIds(events);
  if (passedIds.has(levelId)) return true;

  const idsInBranch = branchLevelIds[branchKey];
  const firstUnpassedIndex = idsInBranch.findIndex((id) => !passedIds.has(id));
  return idsInBranch[firstUnpassedIndex] === levelId;
}
