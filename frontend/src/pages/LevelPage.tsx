// Level page ("/level/:levelId") — looks up the schema and renders
// LevelPlayer. The lookup goes through a small indirection
// (getLevelSchema) so swapping sampleLevels.ts for a full generated schema
// list later is a data change, not a code change to this component.

import { useNavigate, useParams } from "react-router-dom";
import { LevelPlayer } from "../engine/LevelPlayer";
import { sampleLevelsById } from "../engine/sampleLevels";
import type { LevelSchema } from "../engine/types";
import "./pages.css";

// Indirection point: today this is just sampleLevelsById, but any future
// full-content schema source (e.g. a generated levelsById from levels.md)
// only needs to change this one function.
function getLevelSchema(levelId: string): LevelSchema | undefined {
  return sampleLevelsById[levelId];
}

export function LevelPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const schema = levelId ? getLevelSchema(levelId) : undefined;

  if (!schema) {
    return (
      <div className="level-page level-page-missing">
        <h2>找不到這一關</h2>
        <p>
          關卡 <code>{levelId}</code> 還沒有
          schema（目前只有一部分內容轉成資料，見 sampleLevels.ts）。
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

  const handleAdvance = (nextLevelId: string | null) => {
    if (nextLevelId === null) {
      navigate("/");
      return;
    }
    navigate(`/level/${nextLevelId}`);
  };

  return (
    <div className="level-page">
      <LevelPlayer schema={schema} onAdvance={handleAdvance} />
    </div>
  );
}
