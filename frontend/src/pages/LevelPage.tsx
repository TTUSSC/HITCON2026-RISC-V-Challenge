// Level page ("/level/:levelId") — looks up the schema and renders
// LevelPlayer, with a PathMap above it. Passing a level shows a completion
// beat: the full PassMoment celebration on reward-granting passes, or the
// lighter LevelCompleteCard on every other pass. The lookup goes through a
// small indirection (getLevelSchema) so swapping the schema source later is
// a data change, not a code change to this component.

import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { BookOpen, X } from "lucide-react";
import { LevelPlayer } from "../engine/LevelPlayer";
import { levelsById } from "../engine/levels";
import { useSessionStore } from "../engine/sessionStore";
import { isLevelReachable } from "../engine/progression";
import type { LevelSchema } from "../engine/types";
import { PassMoment } from "../components/PassMoment";
import { LevelCompleteCard } from "../components/LevelCompleteCard";
import { CheatSheet } from "../components/CheatSheet";
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
  const events = useSessionStore((s) => s.events);
  const [passInfo, setPassInfo] = useState<PassInfo | null>(null);
  // Set only for passes WITHOUT a reward — shows the lighter
  // LevelCompleteCard beat instead of the full PassMoment celebration (see
  // handleAdvance below).
  const [lightComplete, setLightComplete] = useState(false);
  // Position within the CURRENT level's steps (Duolingo lesson granularity)
  // — reported by LevelPlayer on mount/step-change, not derived from the
  // branch's flat level list anymore (see LevelPlayer.tsx's onStepChange).
  const [stepProgress, setStepProgress] = useState({ index: 0, total: 1 });
  // Cheat sheet is a sibling overlay, not a route change — LevelPlayer below
  // it never unmounts while this toggles, so in-progress widget state (e.g.
  // partially-typed freehand code) survives open/close for free.
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

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

  // Route-level access control: a level is only renderable if it's actually
  // reachable per the player's real progress (already passed, or the first
  // not-yet-passed level in its branch — see engine/progression.ts). Without
  // this, typing /level/L3-Bonus directly worked with zero prior progress,
  // letting anyone skip the entire chain via URL manipulation. A silent
  // redirect back to the map is the right UX here — not an error page, the
  // player just lands where they'd land anyway.
  if (!levelId || !isLevelReachable(levelId, events)) {
    return <Navigate to="/path" replace />;
  }

  // A level completing (schema.onPass firing, after its LAST step's judge
  // passes — never at a step-to-step boundary within the same level, since
  // LevelPlayer only calls onAdvance once, at the end) always drops the
  // player back on the path map, matching real Duolingo behavior: finishing
  // a lesson returns you to the path screen, it never auto-opens the next
  // one. `nextLevelId` (still threaded through from schema.onPass.advance)
  // no longer drives navigation here — PathMap's own reachability logic
  // already derives which node unlocks next from sessionStore's passedAt
  // events, not from this value — but it's kept on PassInfo for now in case
  // a future "peek at what's next" affordance wants it.
  const goToPathMap = () => navigate("/path");

  // Every level pass gets a completion beat, matching real Duolingo (a quick
  // "lesson complete" screen after literally every lesson, scaling up to a
  // bigger celebration only for milestone moments). Only reward-granting
  // passes get the full PassMoment celebration (rice-cooker jump + confetti
  // + pass code) — a single quick tap-through LevelCompleteCard for the rest
  // doesn't meaningfully cost more of the 3–5 分鐘 booth budget than the
  // silent-return version did, it's one extra deliberate tap.
  const handleAdvance = (nextLevelId: string | null) => {
    const reward = schema.onPass.reward;
    if (!reward) {
      setLightComplete(true);
      return;
    }
    // Date.now() here runs inside an event handler (LevelPlayer's onAdvance
    // callback), not during render — safe despite the impurity, but the
    // react-hooks/purity rule can't distinguish that statically.

    const timestamp = Date.now();
    setPassInfo({
      nextLevelId,
      message: `${schema.title} —— 過關！`,
      code: generatePlaceholderCode(sessionId, schema.id, timestamp),
    });
  };

  const handleContinue = () => {
    if (!passInfo) return;
    setPassInfo(null);
    goToPathMap();
  };

  const handleLightContinue = () => {
    setLightComplete(false);
    goToPathMap();
  };

  // Slim progress bar in the top bar reflects position within the CURRENT
  // level's step sequence (Duolingo convention: the bar tracks a single
  // lesson's internal screens, not the whole branch/skill-tree) — see
  // LevelPlayer.tsx's onStepChange and types.ts's file header for why this
  // changed from the old "position across the branch" computation.
  const progressPercent =
    ((stepProgress.index + 1) / Math.max(stepProgress.total, 1)) * 100;

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
        <button
          type="button"
          className="lesson-cheatsheet-btn"
          onClick={() => setCheatSheetOpen(true)}
          aria-label="開啟速查表"
        >
          <BookOpen size={20} />
        </button>
      </div>
      <div className="lesson-body">
        <LevelPlayer
          schema={schema}
          onAdvance={handleAdvance}
          onStepChange={(index, total) => setStepProgress({ index, total })}
        />
      </div>
      <CheatSheet
        open={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
      />
      {passInfo && (
        <PassMoment
          message={passInfo.message}
          code={passInfo.code}
          onContinue={handleContinue}
        />
      )}
      {lightComplete && (
        <LevelCompleteCard
          title={schema.title}
          onContinue={handleLightContinue}
        />
      )}
    </div>
  );
}
