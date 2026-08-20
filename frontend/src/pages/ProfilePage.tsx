// Lightweight local profile page ("/profile") — repo owner's explicit scope:
// a Duolingo-style personal page minus everything that needs an account
// (streak/XP/套章/交友). Shows only what a local-only session can honestly
// know: rewards earned so far, passed-level count vs. total, and the
// current entry branch. No accounts, nothing persisted beyond sessionStore.

import { useState } from "react";
import { Award, ArrowLeft, Pencil, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useSessionStore } from "../engine/sessionStore";
import { levels, BRANCH_TITLES } from "../engine/levels";
import type { RewardKind } from "../engine/types";
import "./ProfilePage.css";

// Short Traditional Chinese display labels for each reward kind — the
// in-app name shown next to the Award badge, distinct from the internal
// RewardKind id used elsewhere for logic.
const REWARD_LABELS: Record<RewardKind, string> = {
  "hitcon-badge": "HITCON 徽章",
  "ttussc-merch": "TTUSSC 周邊",
};

export function ProfilePage() {
  const entryPoint = useSessionStore((s) => s.entryPoint);
  const displayName = useSessionStore((s) => s.displayName);
  const setDisplayName = useSessionStore((s) => s.setDisplayName);
  const events = useSessionStore((s) => s.events);
  const rewards = useSessionStore((s) => s.rewards);

  // Inline-edit, not a modal — same "just a field on the page" weight as the
  // rest of this local-only profile (no accounts, nothing to confirm with a
  // server). Starts open if no name was ever set on EntryPage.
  const [editing, setEditing] = useState(displayName === "");
  const [draft, setDraft] = useState(displayName);

  const commitName = () => {
    setDisplayName(draft.trim());
    setEditing(false);
  };

  const passedCount = events.filter((e) => e.passedAt !== undefined).length;
  const totalCount = levels.length;
  const progressPercent = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;

  // entryPoint mirrors entryFirstLevelId's keys ("L0"/"L1"/"L2"), which line
  // up 1:1 with BRANCH_TITLES's keys of the same name.
  const entryBranchLabel =
    entryPoint in BRANCH_TITLES
      ? BRANCH_TITLES[entryPoint as keyof typeof BRANCH_TITLES]
      : entryPoint;

  return (
    <div className="profile-page">
      <Link to="/path" className="profile-back-link">
        <ArrowLeft size={18} />
        回地圖
      </Link>

      <h1 className="profile-title">個人頁</h1>

      <section className="profile-section">
        <h2 className="profile-section-heading">暱稱</h2>
        {editing ? (
          <div className="profile-name-edit-row">
            <input
              type="text"
              className="profile-name-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitName()}
              placeholder="輸入暱稱"
              maxLength={20}
              autoFocus
            />
            <button
              type="button"
              className="profile-name-btn"
              onClick={commitName}
              aria-label="儲存暱稱"
            >
              <Check size={18} />
            </button>
          </div>
        ) : (
          <div className="profile-name-row">
            <span className="profile-name-value">
              {displayName || "還沒取暱稱"}
            </span>
            <button
              type="button"
              className="profile-name-btn"
              onClick={() => {
                setDraft(displayName);
                setEditing(true);
              }}
              aria-label="編輯暱稱"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
      </section>

      <section className="profile-section">
        <h2 className="profile-section-heading">目前入口分支</h2>
        <p className="profile-entry-branch">{entryBranchLabel}</p>
      </section>

      <section className="profile-section">
        <h2 className="profile-section-heading">通關進度</h2>
        <div className="profile-progress-row">
          <div className="profile-progress-track">
            <div
              className="profile-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="profile-progress-label">
            {passedCount} / {totalCount}
          </span>
        </div>
      </section>

      <section className="profile-section">
        <h2 className="profile-section-heading">已獲得獎勵</h2>
        {rewards.length === 0 ? (
          <p className="profile-empty-state">
            還沒拿到任何獎勵，繼續闖關看看！
          </p>
        ) : (
          <ul className="profile-reward-list">
            {rewards.map((reward, i) => (
              <li
                key={`${reward.levelId}-${i}`}
                className="profile-reward-item"
              >
                <div className="profile-reward-badge">
                  <Award className="icon" />
                </div>
                <div className="profile-reward-info">
                  <span className="profile-reward-name">
                    {REWARD_LABELS[reward.kind]}
                  </span>
                  <span className="profile-reward-source">
                    來自 {reward.levelId}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
