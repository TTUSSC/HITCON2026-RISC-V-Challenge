// Example LevelSchema objects transcribed from docs/design/levels.md, for
// smoke-testing the engine against realistic content instead of placeholder
// copy. Not the full content set — just enough to exercise every widget
// type in the catalog end to end (full content transcription is out of
// scope, see the app-shell task spec).

import type { LevelSchema } from "./types";

// L0-1 — 算術, fill-blank widget, judge.kind: direct. Entry point for the
// "完全沒碰過組合語言" branch.
export const L0_1: LevelSchema = {
  id: "L0-1",
  type: "fill-blank",
  title: "暫存器就是超快的變數",
  prompt: "用 add／addi／sub 湊出目標值：把 a0 設成 5。",
  blanks: [{ id: "imm", answer: "5", options: ["3", "5", "7", "10"] }],
  judge: { kind: "direct" },
  onPass: { advance: "L0-2" },
};

// L1-1 — 翻卡 (flashcard), observation widget, judge.kind: none. Entry point
// for the "會一點 asm/pwn，不熟 RISC-V" branch.
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

// L2-0 — 觀賞, observation widget, judge.kind: none. Entry point for the
// "已經熟 RISC-V" branch.
export const L2_0: LevelSchema = {
  id: "L2-0",
  type: "observation",
  title: "syscall 沒有另一套規則",
  prompt:
    "直接借用 calling convention：a7 放服務編號，a0–a6 當參數。write(a7=64, a0=fd, a1=buf, a2=len)、open(a7=1024, a0=path, a1=flags)、read(a7=63, a0=fd, a1=buf, a2=len)。",
  judge: { kind: "none" },
  onPass: { advance: "L2-1" },
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

// L2-2 — 排序 (選配), drag-order widget, judge.kind: emulator — the ORW
// fragments only produce the right stdout once reordered correctly and
// actually assembled/run (see LevelPlayer.tsx's TODO on raw-input ->
// RunRequest translation for how far that gap currently goes).
export const L2_2: LevelSchema = {
  id: "L2-2",
  type: "drag-order",
  title: "排出正確的 ORW 順序",
  prompt: "把打散的 open／read／write 片段拖回正確順序。",
  items: [
    { id: "open-a7", label: "li a7, 1024   # open syscall number" },
    { id: "open-a0", label: "la a0, path    # 檔名位址" },
    { id: "open-ecall", label: "ecall          # 執行 open" },
    { id: "read-a7", label: "li a7, 63     # read syscall number" },
    { id: "read-ecall", label: "ecall          # 執行 read" },
    { id: "write-a7", label: "li a7, 64     # write syscall number" },
    { id: "write-ecall", label: "ecall          # 執行 write" },
  ],
  correctOrder: [
    "open-a7",
    "open-a0",
    "open-ecall",
    "read-a7",
    "read-ecall",
    "write-a7",
    "write-ecall",
  ],
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L2-3" },
};

// L2-4 — 純手寫 (選配, 完整 ORW 野心目標), freehand-editor widget,
// judge.kind: emulator.
export const L2_4: LevelSchema = {
  id: "L2-4",
  type: "freehand-editor",
  title: "從零刻出完整 ORW",
  prompt: 'open("flag.txt") → read → write，全部自己手寫，沒有任何 scaffold。',
  starterCode: "# open -> read -> write, from scratch\n.text\n_start:\n",
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L2-5" },
};

// L2-5a — 拉桿找 offset, lever-slider widget, judge.kind: direct (target
// defined — this is the "find the answer" instance; L3-1 reuses the same
// component with target undefined for the "feel the wall" instance).
export const L2_5A: LevelSchema = {
  id: "L2-5a",
  type: "lever-slider",
  title: "滑到剛好蓋到 ra 的 offset",
  prompt:
    "拖曳輸入長度滑桿，即時視覺化 buffer → saved s0 → saved ra 被吃掉的過程。",
  min: 0,
  max: 64,
  target: 40,
  judge: { kind: "direct" },
  onPass: { advance: "L2-5b" },
};

// L3-2 — 手動＋自動猜 canary, byte-guesser widget, judge.kind: emulator —
// the "correct" canary bytes only come from real re-runs against the
// vulnerable ELF (see ByteGuesserWidget.tsx's stub note).
export const L3_2: LevelSchema = {
  id: "L3-2",
  type: "byte-guesser",
  title: "猜出完整的 canary",
  prompt:
    "每次重跑都是全新 emulator instance：猜錯崩潰、猜對活下來繼續猜下一個 byte。手動試 1–2 byte，或一鍵自動跑完剩下的。",
  byteCount: 4,
  judge: { kind: "emulator", expect: { exitCode: 0 } },
  onPass: { advance: "L3-3" },
};

// L3-4 — 觀賞＋點選串接 gadget chain, gadget-chain widget, judge.kind:
// emulator — the final chain only counts once it's actually run and prints
// the flag.
export const L3_4: LevelSchema = {
  id: "L3-4",
  type: "gadget-chain",
  title: "串出 ORW gadget chain",
  prompt:
    "buffer 塞不下完整 shellcode，也沒有 win() 可以跳——點選候選 gadget 串出 open → read → write。",
  gadgets: [
    { id: "g1", address: "0x10120", description: "pop a0, a1, a2; ret" },
    { id: "g2", address: "0x10148", description: "pop a7; ret" },
    { id: "g3", address: "0x10160", description: "ecall; ret" },
    { id: "g4", address: "0x10188", description: "mv a0, sp; ret" },
  ],
  correctChain: ["g1", "g2", "g3"],
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L3-Bonus" },
};

export const sampleLevels: LevelSchema[] = [
  L0_1,
  L1_1,
  L1_2,
  L1_3,
  L2_0,
  L2_1,
  L2_2,
  L2_4,
  L2_5A,
  L3_2,
  L3_4,
];

export const sampleLevelsById: Record<string, LevelSchema> = Object.fromEntries(
  sampleLevels.map((level) => [level.id, level]),
);
