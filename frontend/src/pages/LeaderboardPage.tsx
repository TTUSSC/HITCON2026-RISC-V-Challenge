// Leaderboard page ("/leaderboard") — the in-app board, reachable from the
// bottom nav. Deliberately small: this file plus a CSS block, reusing the
// existing 36rem page width and design tokens, with no new runtime dependency.
//
// Depth is shown as the level id ("L2-0"), not the raw number: "深度 9" means
// nothing to a player, while a level id is something this audience reads all
// day. The entry point is shown too, because two players at the same depth got
// there from different starting points.
//
// There is deliberately no "this is you" highlight. GET /api/leaderboard omits
// profileId on purpose (a public response must not hand out identifiers that
// could be replayed to inject progress), and matching on nickname would
// mislabel duplicates. That is the accepted cost of that privacy decision.

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import {
  fetchLeaderboard,
  isLeaderboardEnabled,
  type LeaderboardEntry,
} from "../engine/leaderboardClient";
import "./pages.css";

type LoadState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: LeaderboardEntry[] };

export function LeaderboardPage() {
  const [state, setState] = useState<LoadState>(() =>
    isLeaderboardEnabled() ? { status: "loading" } : { status: "disabled" },
  );

  useEffect(() => {
    if (!isLeaderboardEnabled()) return;
    let cancelled = false;
    fetchLeaderboard()
      .then((entries) => {
        if (!cancelled) setState({ status: "ready", entries });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="leaderboard-page">
      <h1 className="leaderboard-title">
        <Trophy size={22} />
        排行榜
      </h1>

      {state.status === "disabled" && (
        <p className="leaderboard-note">排行榜尚未啟用。</p>
      )}

      {state.status === "loading" && (
        <p className="leaderboard-note">載入中…</p>
      )}

      {state.status === "error" && (
        <p className="leaderboard-note" role="alert">
          排行榜載入失敗,稍後再試一次。
        </p>
      )}

      {state.status === "ready" && state.entries.length === 0 && (
        <p className="leaderboard-note">還沒有人上榜,你可以是第一個。</p>
      )}

      {state.status === "ready" && state.entries.length > 0 && (
        <>
          <p className="leaderboard-count">共 {state.entries.length} 人上榜</p>
          <ol className="leaderboard-list">
            {state.entries.map((item) => (
              <li key={item.rank} className="leaderboard-row">
                <span className="leaderboard-rank">{item.rank}</span>
                <span className="leaderboard-name">{item.displayName}</span>
                <span className="leaderboard-entry-point">
                  {item.entryPoint}
                </span>
                <span className="leaderboard-level">{item.levelId}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
