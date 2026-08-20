// Full level content, transcribed from docs/design/levels.md (the
// canonical source for all copy/flow) and docs/design/platform-architecture.md
// (widget/judge-kind assignment + reward mapping). Supersedes sampleLevels.ts
// as the lookup source for LevelPage.tsx — see getLevelSchema() there.
//
// Widget-specific data not pinned down in levels.md (exact register/memory
// values, gadget list, canary byte count, etc.) is flagged inline with
// `// TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)`.
// levels.md itself calls these out as still needing a real compiled
// vulnerable ELF to lock down — not blocking for this content pass.
//
// Reward mapping (levels.md "現場動線" + 待辦 note, read carefully):
//   - hitcon-badge: granted on the FIRST level with a real pass judgement
//     reached via the L0 or L1 entry branch — NOT simply "the last level of
//     the intro". For L0 that's L0-1 (first fill-blank, judge:direct). For
//     L1 that's L1-2 (L1-1 is judge:none, so L1-2 is the branch's first real
//     判定). Someone entering directly at L2 never passes either level, so
//     they never see the badge — matches "只到 Level 0／Level 1 入口" intent.
//   - ttussc-merch: L2-1 only (first real syscall execution), exactly as
//     levels.md's L2-1 row states.
//
// Chain: L0-1..4 -> L1-1..4 -> L2-0..L2-5(a/b/c) -> L2-Bonus -> L3-0..4 ->
// L3-Bonus -> null. Optional ("選配") levels stay inline in the linear chain
// (the schema only supports a single onPass.advance target; a real "skip
// ahead" affordance is a UI-layer concern out of scope here).

import type { LevelSchema } from "./types";

// ---------------------------------------------------------------------------
// Level 0 — Instruction Warmup
// ---------------------------------------------------------------------------

export const L0_1: LevelSchema = {
  id: "L0-1",
  type: "fill-blank",
  title: "暫存器就是超快的變數",
  prompt:
    "add／addi／sub — 暫存器就是超快的變數。從少數選項中選填空湊出目標值：把 a0 設成 5。",
  blanks: [{ id: "imm", answer: "5", options: ["3", "5", "7", "10"] }],
  judge: { kind: "direct" },
  onPass: { advance: "L0-2", reward: "hitcon-badge" },
};

export const L0_2: LevelSchema = {
  id: "L0-2",
  type: "fill-blank",
  title: "li／mv 其實是假指令",
  prompt:
    "li a0, 5 其實被組譯器展開成 addi a0, x0, 5——li／mv／nop／ret 都是假指令。用 mv 把 a1 的值複製到 a0：mv a0, ___",
  blanks: [{ id: "src", answer: "a1", options: ["a1", "a2", "zero", "ra"] }],
  judge: { kind: "direct" },
  onPass: { advance: "L0-3" },
};

export const L0_3: LevelSchema = {
  id: "L0-3",
  type: "fill-blank",
  title: "暫存器帶不下所有東西，要跟記憶體借",
  prompt:
    "暫存器只有 32 個，帶不下所有東西，要跟記憶體借。lw a0, 0(a1) 是「offset(base)」語法，位址在 a1，從選項中選出補完讀值到 a0 的指令：lw a0, 0(___)",
  blanks: [{ id: "base", answer: "a1", options: ["a0", "a1", "a2", "sp"] }],
  judge: { kind: "direct" },
  onPass: { advance: "L0-4" },
};

export const L0_4: LevelSchema = {
  id: "L0-4",
  type: "observation",
  title: "分支：比較跟跳轉是同一個指令做完的",
  prompt:
    "beq／bne／blt／bge——RISC-V 沒有 flags register，比較跟跳轉是同一個指令做完的。這條技能樹後面用不到 branch（後面都是純線性 syscall 呼叫，或比較邏輯已經編譯進 vulnerable binary），先眼熟就好，不用操作。",
  judge: { kind: "none" },
  onPass: { advance: "L1-1" },
};

// ---------------------------------------------------------------------------
// Level 1 — Calling Convention
// ---------------------------------------------------------------------------

export const L1_1: LevelSchema = {
  id: "L1-1",
  type: "observation",
  title: "a0–a7：你跟外界溝通的管道",
  prompt:
    "這 8 個暫存器（x10–x17）是函式參數／回傳值。先不談 ra／sp，只建立這一件事：這 8 個是你跟外界溝通的管道。",
  judge: { kind: "none" },
  onPass: { advance: "L1-2" },
};

export const L1_2: LevelSchema = {
  id: "L1-2",
  type: "fill-blank",
  title: "syscall number 放哪個暫存器？",
  prompt:
    "你想跟系統要哪個服務？呼叫 read/write/exit 前，系統呼叫編號要放進哪個暫存器？（挑 write 的 syscall 編號）",
  blanks: [{ id: "a7", answer: "a7", options: ["a0", "a1", "a7", "ra"] }],
  registerContext: ["a0", "a1", "a7", "ra"],
  judge: { kind: "direct" },
  onPass: { advance: "L1-3", reward: "hitcon-badge" },
};

export const L1_3: LevelSchema = {
  id: "L1-3",
  type: "fill-blank",
  title: "write 要知道寫到哪裡",
  prompt:
    "write 要知道寫到哪裡：把 a0 設成 1（stdout）。L1-2 ＋ L1-3 合起來等於原本一次到位的目標——過關瞬間已經站在 Level 2 門口。",
  blanks: [{ id: "a0", answer: "1", options: ["0", "1", "2", "64"] }],
  registerContext: ["a0", "a1", "a7"],
  judge: { kind: "direct" },
  onPass: { advance: "L1-4" },
};

export const L1_4: LevelSchema = {
  id: "L1-4",
  type: "observation",
  title: "ra 與 sp：先混個眼熟",
  prompt:
    "ra（x1）：函式怎麼記得要跳回哪。sp（x2）：堆疊指標。不考，純粹先混眼熟——Boss 分支的整個 stack 佈局會直接用到這兩個。",
  judge: { kind: "none" },
  onPass: { advance: "L2-0" },
};

// ---------------------------------------------------------------------------
// Level 2 — Shellcode by Hand
// ---------------------------------------------------------------------------

export const L2_0: LevelSchema = {
  id: "L2-0",
  type: "observation",
  title: "syscall 沒有另一套規則",
  prompt:
    "直接借用 calling convention：a7 放服務編號，a0–a6 當參數。write(a7=64, a0=fd, a1=buf, a2=len)、open(a7=1024, a0=path, a1=flags)、read(a7=63, a0=fd, a1=buf, a2=len)。冷知識：open 的編號是 1024，不是常見 Linux 系統上的 openat（56）——rv32emu 的精簡 syscall table 只實作了 open，沒有 openat。",
  judge: { kind: "none" },
  onPass: { advance: "L2-1" },
};

export const L2_1: LevelSchema = {
  id: "L2-1",
  type: "drag-fill",
  title: "寫出你的第一個 syscall",
  prompt: "拖曳字串位址／長度進 a1／a2，組出一段能印出 HI 的 shellcode。",
  slots: [
    {
      id: "a1",
      label: "字串位址",
      // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
      options: ["0x10000", "0x20000", "0x30000"],
      answer: "0x10000",
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

export const L2_2: LevelSchema = {
  id: "L2-2",
  type: "drag-order",
  title: "排出正確的 ORW 順序",
  prompt:
    "給正確但打散的 open／read／write 片段（用 L2-0 已預覽過的三個 syscall），拖曳排回順序。",
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
  // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦) —
  // exact expected stdout fragment depends on the real flag.txt contents.
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L2-3" },
};

export const L2_3: LevelSchema = {
  id: "L2-3",
  type: "fill-blank",
  title: "填出正確的 syscall 編號",
  prompt:
    "給有洞的骨架（li a7, ___ / ecall 結構都在），從有限選項填暫存器名稱或立即值。目標是印出 write 的結果。",
  blanks: [
    { id: "a7value", answer: "64", options: ["1024", "63", "64", "93"] },
  ],
  judge: { kind: "direct" },
  onPass: { advance: "L2-4" },
};

export const L2_4: LevelSchema = {
  id: "L2-4",
  type: "freehand-editor",
  title: "從零刻出完整 ORW",
  prompt:
    'open("flag.txt") → read → write，全部自己手寫，拿掉所有 scaffold。已經熟 RISC-V 的人可以直接跳來這裡秀操作。',
  starterCode: "# open -> read -> write, from scratch\n.text\n_start:\n",
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L2-5a" },
};

export const L2_5A: LevelSchema = {
  id: "L2-5a",
  type: "lever-slider",
  title: "滑到剛好蓋到 ra 的 offset",
  prompt:
    "拖曳輸入長度滑桿，即時視覺化 buffer → saved s0 → saved ra 被吃掉的過程，滑到剛好蓋到 ra 的 offset。",
  min: 0,
  max: 64,
  // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
  target: 40,
  // Stack shape matches the target above: 32-byte buffer + 4-byte saved s0
  // means offset 36 is where saved ra begins, but the "just right" answer
  // is framed as "剛好蓋到 ra" so target sits right at that boundary +4
  // slack; adjust alongside target once the real test ELF lands.
  stackVisual: {
    bufferSize: 32,
    mode: "offset",
    savedS0Size: 4,
    savedRaSize: 4,
  },
  judge: { kind: "direct" },
  onPass: { advance: "L2-5b" },
};

export const L2_5B: LevelSchema = {
  id: "L2-5b",
  type: "fill-blank",
  title: "選出 win() 的位址",
  prompt: "從候選清單選出／填入 win() 的位址（選單挑，不用手打十六進位）。",
  blanks: [
    {
      id: "winAddr",
      // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
      answer: "0x10074",
      options: ["0x10050", "0x10074", "0x100a0", "0x100c8"],
    },
  ],
  judge: { kind: "direct" },
  onPass: { advance: "L2-5c" },
};

export const L2_5C: LevelSchema = {
  id: "L2-5c",
  type: "drag-order",
  title: "排出正確的 payload",
  prompt:
    "拖曳排出 [padding × offset] → [隨便的 saved s0] → [win() 位址] 的正確順序，排對即成為真正丟進 rv32emu 執行的 payload。",
  items: [
    { id: "padding", label: "padding × offset（填滿 buffer）" },
    { id: "fake-s0", label: "隨便的 saved s0" },
    { id: "win-addr", label: "win() 位址" },
  ],
  correctOrder: ["padding", "fake-s0", "win-addr"],
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L2-Bonus" },
};

export const L2_BONUS: LevelSchema = {
  id: "L2-Bonus",
  type: "freehand-editor",
  title: "拿掉所有輔助，自己組出完整 payload",
  prompt:
    "跟 L2-5 同一支 binary，但拿掉所有輔助：沒有滑桿（自己找 offset）、沒有位址選單（自己算/找 win() 位址）、沒有排序輔助（自己組完整 raw payload bytes）。完賽與否不影響 L2-5 → Boss 的銜接。",
  starterCode: "# raw payload bytes, no scaffold\n",
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L3-0" },
};

// ---------------------------------------------------------------------------
// Boss — Canary & ROP
// ---------------------------------------------------------------------------

export const L3_0: LevelSchema = {
  id: "L3-0",
  type: "observation",
  title: "Canary：編譯器塞的哨兵值",
  prompt:
    "canary 是編譯器塞在 buffer 和 ra 之間的哨兵值，被沖走代表越界，程式自殺（*** stack smashing detected ***）。",
  judge: { kind: "none" },
  onPass: { advance: "L3-1" },
};

export const L3_1: LevelSchema = {
  id: "L3-1",
  type: "lever-slider",
  title: "撞牆：這次先撞到 canary",
  prompt:
    "跟 L2-5a 用同一個滑桿元件，但這次拖曳輸入長度會先撞到新的東西：canary。動畫顯示 buffer 填滿、吃進 canary、觸發偵測當掉——這裡是「滑到撞牆」，同工具、新阻礙。純建立直覺，不用真的 leak。",
  min: 0,
  max: 64,
  // No target: judge.kind is 'none', this is pure feel (see types.ts).
  // Same buffer/s0/ra shape as L2-5a, plus a 4-byte canary sitting right
  // after the buffer — see levels.md Boss section's ASCII stack diagram.
  stackVisual: {
    bufferSize: 32,
    mode: "canary",
    canarySize: 4,
    savedS0Size: 4,
    savedRaSize: 4,
  },
  judge: { kind: "none" },
  onPass: { advance: "L3-2" },
};

export const L3_2: LevelSchema = {
  id: "L3-2",
  type: "byte-guesser",
  title: "猜出完整的 canary",
  prompt:
    "猜錯崩潰、猜對活下來繼續猜下一個 byte（每次重跑都是全新 emulator instance）。手動試 1–2 byte 感受，再一鍵自動跑完剩下的。",
  // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
  byteCount: 4,
  judge: { kind: "emulator", expect: { exitCode: 0 } },
  onPass: { advance: "L3-3" },
};

export const L3_3: LevelSchema = {
  id: "L3-3",
  type: "drag-order",
  title: "組出完整 payload：canary 版",
  prompt:
    "跟 L2-5c 的組裝技巧一樣，只是這次 payload 多了一段 canary：組出完整 payload：buffer 填滿＋正確 canary＋隨便的 s0＋新的 ra。",
  items: [
    { id: "buffer", label: "buffer 填滿" },
    { id: "canary", label: "正確 canary" },
    { id: "fake-s0", label: "隨便的 saved s0" },
    { id: "new-ra", label: "新的 ra（跳轉目標）" },
  ],
  correctOrder: ["buffer", "canary", "fake-s0", "new-ra"],
  judge: { kind: "emulator", expect: { exitCode: 0 } },
  onPass: { advance: "L3-4" },
};

export const L3_4: LevelSchema = {
  id: "L3-4",
  type: "gadget-chain",
  title: "串出 ORW gadget chain",
  prompt:
    "buffer 塞不下完整 shellcode，這次也沒有 win() 可以跳——gadget 是一段以 ret 結尾、可拼接利用的指令片段。用點選串接的方式組出 ORW chain。",
  gadgets: [
    // TODO: placeholder pending real test ELF (see levels.md 待辦: L3-4 的
    // gadget 清單內容，需從實際編出來的 vulnerable binary 掃出可用 gadget)
    { id: "g1", address: "0x10120", description: "pop a0, a1, a2; ret" },
    { id: "g2", address: "0x10148", description: "pop a7; ret" },
    { id: "g3", address: "0x10160", description: "ecall; ret" },
    { id: "g4", address: "0x10188", description: "mv a0, sp; ret" },
  ],
  correctChain: ["g1", "g2", "g3"],
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: "L3-Bonus" },
};

export const L3_BONUS: LevelSchema = {
  id: "L3-Bonus",
  type: "freehand-editor",
  title: "終盤大魔王：自己反組譯、自己串 ROP",
  prompt:
    "跟 L3-4 同一支 binary，但拿掉 gadget 清單輔助：自己反組譯找 gadget、自己算位址、自己串出完整 raw payload。這才是真正的「終盤大魔王／破台」成就，完賽與否不影響 L3-4 已經拿到的完賽感。",
  starterCode: "# find your own gadgets, no candidate list\n",
  judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
  onPass: { advance: null },
};

// ---------------------------------------------------------------------------

export const levels: LevelSchema[] = [
  L0_1,
  L0_2,
  L0_3,
  L0_4,
  L1_1,
  L1_2,
  L1_3,
  L1_4,
  L2_0,
  L2_1,
  L2_2,
  L2_3,
  L2_4,
  L2_5A,
  L2_5B,
  L2_5C,
  L2_BONUS,
  L3_0,
  L3_1,
  L3_2,
  L3_3,
  L3_4,
  L3_BONUS,
];

export const levelsById: Record<string, LevelSchema> = Object.fromEntries(
  levels.map((level) => [level.id, level]),
);

// Ordered branch level-id lists, for PathMap's linear-gating display —
// mirrors the chain each entry point actually walks (see the module-level
// comment above for how the chains were decided).
export const branchLevelIds = {
  L0: ["L0-1", "L0-2", "L0-3", "L0-4"],
  L1: ["L1-1", "L1-2", "L1-3", "L1-4"],
  L2: [
    "L2-0",
    "L2-1",
    "L2-2",
    "L2-3",
    "L2-4",
    "L2-5a",
    "L2-5b",
    "L2-5c",
    "L2-Bonus",
  ],
  Boss: ["L3-0", "L3-1", "L3-2", "L3-3", "L3-4", "L3-Bonus"],
} as const;

// Which branchLevelIds bucket a given level id's PathMap segment belongs to
// — keyed by id prefix, not by session entryPoint, so the map always shows
// the segment the player is currently walking through (e.g. an L0 entrant
// who has moved on into L2 sees the L2 segment, not a stale L0 one).
export function branchKeyForLevel(
  levelId: string,
): keyof typeof branchLevelIds | undefined {
  if (levelId.startsWith("L0-")) return "L0";
  if (levelId.startsWith("L1-")) return "L1";
  if (levelId.startsWith("L2-")) return "L2";
  if (levelId.startsWith("L3-")) return "Boss";
  return undefined;
}
