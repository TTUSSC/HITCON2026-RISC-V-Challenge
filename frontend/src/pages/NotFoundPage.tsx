// App-level catch-all ("*" route) — reached when a URL doesn't match any
// known route at all (typo, stale/shared link, direct nav to a path this
// app never had). Distinct from LevelPage's own "找不到這一關" case, which
// handles a syntactically valid /level/:levelId whose id just isn't in
// levels.ts — this one is for paths react-router itself can't match.
import { useNavigate } from "react-router-dom";
import "./pages.css";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="level-page level-page-missing">
      <h2>找不到這個頁面</h2>
      <p>這個網址不存在，回到入口頁重新開始吧。</p>
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
