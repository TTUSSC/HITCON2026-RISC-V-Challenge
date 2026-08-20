// Map/home screen ("/path") — Duolingo's actual home-screen convention:
// a single path of lesson nodes under the persistent app header (title +
// theme toggle, already rendered by App.tsx), nothing else. Tapping a
// reachable node jumps straight into that level's question screen; locked
// nodes are simply non-interactive (see PathMap.tsx).
//
// Which branch segment to show is derived from progress, not from a route
// param: find the furthest-along not-yet-passed level starting from this
// session's entry point (see levels.ts entryFirstLevelId), then show the
// segment that level belongs to — mirrors branchKeyForLevel's own comment
// about always showing the segment currently being walked through.

import { useNavigate } from "react-router-dom";
import { PathMap } from "../components/PathMap";
import { useSessionStore } from "../engine/sessionStore";
import {
  levels,
  branchLevelIds,
  branchKeyForLevel,
  entryFirstLevelId,
} from "../engine/levels";
import "./pages.css";

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

  const branchKey = branchKeyForLevel(currentLevel.id);
  const pathLevelIds = branchKey ? branchLevelIds[branchKey] : [];

  return (
    <div className="map-page">
      <PathMap
        levelIds={[...pathLevelIds]}
        onSelectLevel={(levelId) => navigate(`/level/${levelId}`)}
      />
    </div>
  );
}
