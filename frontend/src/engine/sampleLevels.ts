// Example LevelSchema objects transcribed from docs/design/levels.md, for
// smoke-testing the engine against realistic content instead of placeholder
// copy. Not the full content set — just enough to exercise observation,
// fill-blank, and an emulator-judged widget end to end.

import type { LevelSchema } from "./types";

// L1-1 — 翻卡 (flashcard), observation widget, judge.kind: none.
export const L1_1: LevelSchema = {
  id: "L1-1",
  type: "observation",
  title: "a0–a7：你跟外界溝通的管道",
  prompt:
    "這 8 個暫存器（x10–x17）是函式參數／回傳值。先不談 ra／sp，只建立這一件事。",
  judge: { kind: "none" },
  onPass: { advance: "L1-2" },
};

// L1-2 — 填空 (單變數), fill-blank widget, judge.kind: direct.
export const L1_2: LevelSchema = {
  id: "L1-2",
  type: "fill-blank",
  title: "syscall number 放哪個暫存器？",
  prompt: "呼叫 read/write/exit 前，系統呼叫編號要放進哪個暫存器？",
  blanks: [{ id: "a7", answer: "a7", options: ["a0", "a1", "a7", "ra"] }],
  judge: { kind: "direct" },
  onPass: { advance: "L1-3" },
};

// L1-3 — 填空 (承接 L1-2), fill-blank widget, judge.kind: direct.
// (Illustrative — real judge condition is "a7 == 64 && a0 == 1" per
// levels.md, but the direct-judge comparator in judge.ts only compares
// blank answers, so the answer values below encode the same intent.)
export const L1_3: LevelSchema = {
  id: "L1-3",
  type: "fill-blank",
  title: "write 要知道寫到哪裡",
  prompt: "把 a0 設成 1（stdout），完成 write 呼叫需要的最後一塊。",
  blanks: [{ id: "a0", answer: "1", options: ["0", "1", "2", "64"] }],
  judge: { kind: "direct" },
  onPass: { advance: "L2-0", reward: "hitcon-badge" },
};

// L2-1 — 拖曳視覺化 (drag-fill widget is a stub, but the schema is complete
// and valid), judge.kind: emulator — real判定, not string comparison.
export const L2_1: LevelSchema = {
  id: "L2-1",
  type: "drag-fill",
  title: "寫出你的第一個 syscall",
  prompt: "拖曳字串位址／長度進 a1／a2，組出一段能印出 HI 的 shellcode",
  slots: [
    {
      id: "a1",
      label: "字串位址",
      options: ["0x1000", "0x2000", "0x3000"],
      answer: "0x1000",
    },
    {
      id: "a2",
      label: "長度",
      options: ["1", "2", "4"],
      answer: "2",
    },
  ],
  judge: { kind: "emulator", expect: { stdout: "HI" } },
  onPass: { advance: "L2-2", reward: "ttussc-merch" },
};

export const sampleLevels: LevelSchema[] = [L1_1, L1_2, L1_3, L2_1];

export const sampleLevelsById: Record<string, LevelSchema> = Object.fromEntries(
  sampleLevels.map((level) => [level.id, level]),
);
