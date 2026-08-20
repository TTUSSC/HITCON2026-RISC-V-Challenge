// Map/home screen ("/path") — Duolingo's actual home-screen convention:
// a path of lesson nodes under the persistent app header (title + theme
// toggle, already rendered by App.tsx), nothing else. Tapping a reachable
// node jumps straight into that level's question screen; locked nodes are
// simply non-interactive (see PathMap.tsx).
//
// Previously this only ever rendered the single branch segment containing
// the session's current furthest-along level — a confirmed, previously
// flagged bug: a player who moved from L0 into L1 lost all visibility of
// their completed L0 nodes. Fixed here by rendering one PathMap section per
// branch the player has actually entered (derived from sessionStore's
// events, not just the current one), stacked in canonical branch order, each
// under its own heading — "stacked branch sections" per the task brief's
// suggested layout. The currently-active branch (same "furthest-along
// not-yet-passed level" logic as before) is still the one whose "current"
// node is tappable-and-highlighted; earlier branches show as fully "done".

import { useNavigate } from "react-router-dom";
import { PathMap } from "../components/PathMap";
import { useSessionStore } from "../engine/sessionStore";
import {
  levels,
  branchLevelIds,
  branchKeyForLevel,
  entryFirstLevelId,
  BRANCH_ORDER,
  BRANCH_TITLES,
  type BranchKey,
} from "../engine/levels";
import "./pages.css";

// Levels whose onPass grants a real reward (hitcon-badge / ttussc-merch) —
// these are the only levels that "count" as a real 通關 per the repo
// owner's L0-demotion decision (see levels.ts's file header); PathMap marks
// these distinctly from an ordinary passed node.
const rewardLevelIds = new Set(
  levels.filter((l) => l.onPass.reward).map((l) => l.id),
);

export function MapPage() {
  const navigate = useNavigate();
  const entryPoint = useSessionStore((s) => s.entryPoint);
  const events = useSessionStore((s) => s.events);

  const passedIds = new Set(
    events.filter((e) => e.passedAt !== undefined).map((e) => e.levelId),
  );

  const startId = entryFirstLevelId[entryPoint];
  const startIndex = Math.max(
    0,
    levels.findIndex((l) => l.id === startId),
  );
  const currentLevel =
    levels.slice(startIndex).find((l) => !passedIds.has(l.id)) ??
    levels[levels.length - 1];
  const activeBranchKey = branchKeyForLevel(currentLevel.id);

  // Every branch the session has ever entered a level in, plus the active
  // branch (so a fresh session still sees its starting branch before it has
  // passed anything).
  const enteredBranchKeys = new Set<BranchKey>(
    events
      .map((e) => branchKeyForLevel(e.levelId))
      .filter((key): key is BranchKey => key !== undefined),
  );
  if (activeBranchKey) enteredBranchKeys.add(activeBranchKey);

  const visibleBranches = BRANCH_ORDER.filter((key) =>
    enteredBranchKeys.has(key),
  );

  return (
    <div className="map-page">
      {visibleBranches.map((key) => (
        <section key={key} className="map-branch-section">
          <h2 className="map-branch-heading">{BRANCH_TITLES[key]}</h2>
          <PathMap
            levelIds={[...branchLevelIds[key]]}
            rewardLevelIds={rewardLevelIds}
            onSelectLevel={(levelId) => navigate(`/level/${levelId}`)}
          />
        </section>
      ))}
    </div>
  );
}
