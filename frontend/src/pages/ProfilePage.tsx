// Lightweight local profile page ("/profile") — repo owner's explicit scope:
// a Duolingo-style personal page minus everything that needs an account
// (streak/XP/套章/交友). Shows only what a local-only session can honestly
// know: rewards earned so far, passed-level count vs. total, and the
// current entry branch. No accounts, nothing persisted beyond sessionStore.

import { useState } from "react";
import {
  Award,
  ArrowLeft,
  Pencil,
  Check,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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

// Three stages before anything destructive actually happens, per the repo
// owner's explicit ask — a native `confirm()` would be one native dialog and
// look out of place; this instead: (1) plain button "清空"/"刪除", (2) a
// second click arms it, swapping the label to an explicit "確定..." state,
// (3) a third click opens a real modal (onRequestConfirm below) where the
// action only fires if the player confirms there too. Arming resets on blur
// — deliberately simple, good enough for a booth kiosk where a stray second
// tap is unlikely.
function DangerButton({
  icon: Icon,
  label,
  confirmLabel,
  onRequestConfirm,
}: {
  icon: typeof Trash2;
  label: string;
  confirmLabel: string;
  onRequestConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`profile-danger-btn${armed ? " profile-danger-btn-armed" : ""}`}
      onClick={() => {
        if (armed) {
          onRequestConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      <Icon size={16} />
      {armed ? confirmLabel : label}
    </button>
  );
}

interface DangerModalContent {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const entryPoint = useSessionStore((s) => s.entryPoint);
  const profileId = useSessionStore((s) => s.profileId);
  const displayName = useSessionStore((s) => s.displayName);
  const setDisplayName = useSessionStore((s) => s.setDisplayName);
  const events = useSessionStore((s) => s.events);
  const rewards = useSessionStore((s) => s.rewards);
  const resetProgress = useSessionStore((s) => s.resetProgress);
  const deleteProfile = useSessionStore((s) => s.deleteProfile);

  const [dangerModal, setDangerModal] = useState<DangerModalContent | null>(
    null,
  );

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

      <section className="profile-section">
        <h2 className="profile-section-heading profile-danger-heading">
          危險操作
        </h2>
        <div className="profile-danger-zone">
          <div className="profile-danger-row">
            <div className="profile-danger-copy">
              <span className="profile-danger-title">清空關卡紀錄</span>
              <span className="profile-danger-desc">
                重置所有關卡的通關進度，暱稱和獎勵不受影響。適合想重刷速度的人。
              </span>
            </div>
            <DangerButton
              icon={RotateCcw}
              label="清空"
              confirmLabel="確定清空？"
              onRequestConfirm={() =>
                setDangerModal({
                  title: "清空關卡紀錄？",
                  body: "所有關卡的通關進度會重置，暱稱和已獲得的獎勵不受影響。這個動作無法復原。",
                  confirmLabel: "清空紀錄",
                  onConfirm: resetProgress,
                })
              }
            />
          </div>
          <div className="profile-danger-row">
            <div className="profile-danger-copy">
              <span className="profile-danger-title">刪除帳號</span>
              <span className="profile-danger-desc">
                清除暱稱、進度與獎勵，並回到入口重新開始，無法復原。
              </span>
            </div>
            <DangerButton
              icon={Trash2}
              label="刪除"
              confirmLabel="確定刪除？"
              onRequestConfirm={() =>
                setDangerModal({
                  title: "刪除帳號？",
                  body: "暱稱、進度與獎勵都會被清除，並回到入口重新開始。這個動作無法復原。",
                  confirmLabel: "刪除帳號",
                  onConfirm: () => {
                    deleteProfile();
                    navigate("/");
                  },
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Stable per-browser id (engine/profileId.ts) — no backend to submit
          to yet, but shown so a player can quote it to staff if one ever
          gets wired up, and so this identity isn't invisible/undiscoverable
          in the meantime. */}
      <p className="profile-id-footer" title={profileId}>
        識別碼 {profileId.slice(0, 8)}
      </p>

      {dangerModal && (
        <div
          className="profile-danger-modal-overlay"
          onClick={() => setDangerModal(null)}
        >
          <div
            className="profile-danger-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="profile-danger-modal-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="profile-danger-modal-heading"
              className="profile-danger-modal-heading"
            >
              {dangerModal.title}
            </h2>
            <p className="profile-danger-modal-body">{dangerModal.body}</p>
            <div className="profile-danger-modal-actions">
              <button
                type="button"
                className="profile-danger-modal-cancel-btn"
                onClick={() => setDangerModal(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="profile-danger-modal-confirm-btn"
                onClick={() => {
                  dangerModal.onConfirm();
                  setDangerModal(null);
                }}
              >
                {dangerModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
