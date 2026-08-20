// Level page ("/level/:levelId") — looks up the schema and renders
// LevelPlayer, with a PathMap above it and a PassMoment celebration on
// reward-granting passes. The lookup goes through a small indirection
// (getLevelSchema) so swapping the schema source later is a data change,
// not a code change to this component.

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { LevelPlayer } from "../engine/LevelPlayer";
import {
  levelsById,
  branchLevelIds,
  branchKeyForLevel,
} from "../engine/levels";
import { useSessionStore } from "../engine/sessionStore";
import type { LevelSchema } from "../engine/types";
import { PassMoment } from "../components/PassMoment";
import "./pages.css";

// Indirection point: full-content schema source generated from
// docs/design/levels.md (see engine/levels.ts) — only this function needs to
// change if the lookup source ever changes again.
function getLevelSchema(levelId: string): LevelSchema | undefined {
  return levelsById[levelId];
}

// TODO: replace with real HMAC per platform-architecture.md once the
// algorithm is finalized ("過關憑證" section — rotating key + EmulatorResult
// hash, not yet designed). This is a plausible-looking placeholder derived
// from sessionId + levelId + timestamp via a simple string hash, purely for
// UI purposes — it proves nothing cryptographically.
function generatePlaceholderCode(
  sessionId: string,
  levelId: string,
  timestamp: number,
): string {
  const input = `${sessionId}:${levelId}:${timestamp}`;
  let hash = 0x811c9dc5; // FNV-1a-ish, good enough for a display code
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `TTUSSC-${hex}`;
}

interface PassInfo {
  nextLevelId: string | null;
  message: string;
  code?: string;
}

export function LevelPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const sessionId = useSessionStore((s) => s.sessionId);
  const [passInfo, setPassInfo] = useState<PassInfo | null>(null);

  const schema = levelId ? getLevelSchema(levelId) : undefined;

  if (!schema) {
    return (
      <div className="level-page level-page-missing">
        <h2>找不到這一關</h2>
        <p>
          關卡 <code>{levelId}</code> 還沒有 schema（見 engine/levels.ts）。
        </p>
        <button
          type="button"
          className="widget-primary-btn"
          onClick={() => navigate("/")}
        >
          回入口頁
        </button>
      </div>
    );
  }

  const goTo = (nextLevelId: string | null) => {
    if (nextLevelId === null) {
      // Whole chain cleared — back to the map, which now shows every node
      // in the final segment as done.
      navigate("/path");
      return;
    }
    navigate(`/level/${nextLevelId}`);
  };

  // Only reward-granting passes get the full celebration beat — inserting a
  // "繼續" click after every micro-step (most levels are single-concept
  // fill-blanks/observations) would eat into the 3–5 分鐘 booth budget the
  // whole level design is built around (see levels.md 前提與限制). Passes
  // without a reward just advance immediately, same as before.
  const handleAdvance = (nextLevelId: string | null) => {
    const reward = schema.onPass.reward;
    if (!reward) {
      goTo(nextLevelId);
      return;
    }
    // Date.now() here runs inside an event handler (LevelPlayer's onAdvance
    // callback), not during render — safe despite the impurity, but the
    // react-hooks/purity rule can't distinguish that statically.
    // eslint-disable-next-line react-hooks/purity
    const timestamp = Date.now();
    setPassInfo({
      nextLevelId,
      message: `${schema.title} —— 過關！`,
      code: generatePlaceholderCode(sessionId, schema.id, timestamp),
    });
  };

  const handleContinue = () => {
    if (!passInfo) return;
    const { nextLevelId } = passInfo;
    setPassInfo(null);
    goTo(nextLevelId);
  };

  // Slim progress bar in the top bar reflects position within the branch
  // segment (Duolingo convention) — not per-widget progress, which most
  // levels here don't have (single-question levels).
  const branchKey = branchKeyForLevel(schema.id);
  const pathLevelIds: string[] = branchKey
    ? [...branchLevelIds[branchKey]]
    : [];
  const indexInSegment = pathLevelIds.indexOf(schema.id);
  const progressPercent =
    pathLevelIds.length > 0 && indexInSegment >= 0
      ? ((indexInSegment + 1) / pathLevelIds.length) * 100
      : 100;

  return (
    <div className="lesson-page">
      <div className="lesson-topbar">
        <button
          type="button"
          className="lesson-close-btn"
          onClick={() => navigate("/path")}
          aria-label="回到地圖"
        >
          <X size={22} />
        </button>
        <div className="lesson-progress-track">
          <div
            className="lesson-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <div className="lesson-body">
        <LevelPlayer schema={schema} onAdvance={handleAdvance} />
      </div>
      {passInfo && (
        <PassMoment
          message={passInfo.message}
          code={passInfo.code}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
