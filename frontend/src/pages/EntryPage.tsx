// Entry-select page ("/") — the 三選一入口 from docs/design/levels.md: pick
// by RISC-V familiarity, not by "skill level" framing. Picking a card opens a
// nickname modal (repo owner's explicit ask: fill in the profile step *after*
// picking difficulty, not before) — confirming there sets both entryPoint and
// displayName in one commit and navigates to the map.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, Wrench, Cpu } from "lucide-react";
import { useSessionStore } from "../engine/sessionStore";
import type { SessionProgress } from "../engine/types";
import "./pages.css";

interface EntryOption {
  entryPoint: SessionProgress["entryPoint"];
  firstLevelId: string;
  icon: typeof PenLine;
  title: string;
  description: string;
}

const options: EntryOption[] = [
  {
    entryPoint: "L0",
    firstLevelId: "L0-1",
    icon: PenLine,
    title: "完全沒碰過組合語言",
    description: "從最基本的暫存器與指令開始，一步一步來。",
  },
  {
    entryPoint: "L1",
    firstLevelId: "L1-1",
    icon: Wrench,
    title: "會一點 asm 或 pwn",
    description: "跳過語法暖身，直接了解 RISC-V calling convention。",
  },
  {
    entryPoint: "L2",
    firstLevelId: "L2-0",
    icon: Cpu,
    title: "已經熟 RISC-V",
    description: "直接進 Level 2，動手寫你的第一個 syscall。",
  },
];

export function EntryPage() {
  const navigate = useNavigate();
  const setEntryPoint = useSessionStore((s) => s.setEntryPoint);
  const setDisplayName = useSessionStore((s) => s.setDisplayName);
  const [pendingOption, setPendingOption] = useState<EntryOption | null>(null);
  const [nickname, setNickname] = useState("");

  const confirmEntry = () => {
    if (!pendingOption) return;
    // Trimmed at the moment of committing, not on every keystroke, so a
    // still-typing player never sees their input silently rewritten. Empty
    // input just leaves displayName "" — ProfilePage falls back to a
    // generic label rather than forcing a name.
    setDisplayName(nickname.trim());
    setEntryPoint(pendingOption.entryPoint);
    // Land on the map first (Duolingo-style home screen), not straight into
    // the first question — the map is where a session picks where to start.
    navigate("/path");
  };

  return (
    <div className="entry-page">
      <h1 className="entry-title">你對 RISC-V 有多熟？</h1>
      <p className="entry-subtitle">選一個最符合你現在程度的入口，開始挑戰。</p>
      <div className="entry-options">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.entryPoint}
              type="button"
              className="entry-card"
              onClick={() => {
                setNickname("");
                setPendingOption(option);
              }}
            >
              <Icon size={32} className="entry-card-icon" />
              <span className="entry-card-title">{option.title}</span>
              <span className="entry-card-description">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      {pendingOption && (
        <div
          className="entry-nickname-overlay"
          onClick={() => setPendingOption(null)}
        >
          <div
            className="entry-nickname-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-nickname-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="entry-nickname-heading" className="entry-nickname-heading">
              幫自己取個暱稱吧
            </h2>
            <p className="entry-nickname-subtext">
              會顯示在你的個人頁，之後也可以再改。
            </p>
            <input
              type="text"
              className="entry-nickname-input"
              placeholder="你的暱稱（選填）"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmEntry()}
              maxLength={20}
              autoFocus
            />
            <div className="entry-nickname-actions">
              <button
                type="button"
                className="entry-nickname-skip-btn"
                onClick={confirmEntry}
              >
                跳過
              </button>
              <button
                type="button"
                className="entry-nickname-confirm-btn"
                onClick={confirmEntry}
              >
                開始挑戰
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
