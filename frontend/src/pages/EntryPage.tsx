// Entry-select page ("/") — the 三選一入口 from docs/design/levels.md: pick
// by RISC-V familiarity, not by "skill level" framing. Each card sets the
// session's entryPoint in sessionStore and navigates straight to that
// branch's first level id.

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

  const handleSelect = (option: EntryOption) => {
    setEntryPoint(option.entryPoint);
    navigate(`/level/${option.firstLevelId}`);
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
              onClick={() => handleSelect(option)}
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
    </div>
  );
}
