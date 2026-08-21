// Full level content, transcribed from docs/design/levels.md (the
// canonical source for all copy/flow) and docs/design/platform-architecture.md
// (widget/judge-kind assignment + reward mapping). Supersedes sampleLevels.ts
// as the lookup source for LevelPage.tsx — see getLevelSchema() there.
//
// Phase 3 shape (see engine/types.ts's file header): each level is a
// `steps` sequence, not a single full-screen widget — the repo owner's
// explicit complaint was that one Ln-m = one progress bar = one exercise
// gave no room to explain/set up before asking the player to do something.
// Three levels got real multi-step treatment as references (each step
// genuinely earns its place): L0-1 (arithmetic — observation explainer then
// the fill-blank practice), L1-2 (syscall ABI — observation walking a7/a0-a2
// with a RegisterBank recap then the fill-blank practice), L2-1 (first real
// syscall — observation recapping the write() signature with the exact
// registers this step's drag-fill will fill in, then the practice). Every
// other level is a minimal 1-step wrap of its old single-widget content —
// flagged inline with `// TODO: expand into a richer multi-step sequence`
// per the explicit MVP-now-iterate-later instruction; the schema SHAPE has
// migrated for all 23 levels, only the content depth differs.
//
// Widget-specific data not pinned down in levels.md (exact register/memory
// values, gadget list, canary byte count, etc.) is flagged inline with
// `// TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)`.
// levels.md itself calls these out as still needing a real compiled
// vulnerable ELF to lock down — not blocking for this content pass.
//
// Reward mapping (levels.md "現場動線" + 待辦 note, read carefully):
//   - hitcon-badge: granted once, at L1-2, regardless of whether the player
//     entered at L0 or L1 — L0 (L0-1..4) is pure hand-holding tutorial
//     content ("保母教學") and deliberately carries no reward, so an L0
//     entrant just walks through it as ungated setup and hits the same
//     L1-2 badge moment an L1 entrant does (L1-1 is judge:none, so L1-2 is
//     the branch's first real 判定 either way). Someone entering directly
//     at L2 never reaches L1-2, so they never see the badge — matches
//     「只到 Level 0／Level 1 入口」 intent.
//   - ttussc-merch: L2-1 only (first real syscall execution), exactly as
//     levels.md's L2-1 row states.
//
// Chain: L0-1..4 -> L1-1..4 -> L2-0..L2-5(a/b/c) -> L2-Bonus -> L3-0..4 ->
// L3-Bonus -> null. Optional ("選配") levels stay inline in the linear chain
// (the schema only supports a single onPass.advance target; a real "skip
// ahead" affordance is a UI-layer concern out of scope here).

import type { LevelSchema } from "./types";
import { BASE_ADDRESS } from "./assembler";

// ---------------------------------------------------------------------------
// Level 0 — Instruction Warmup
// ---------------------------------------------------------------------------

export const L0_1: LevelSchema = {
  id: "L0-1",
  title: "暫存器就是超快的變數",
  // No reward — L0 is pure hand-holding tutorial content ("保母教學"), the
  // hitcon-badge celebration is reserved for L1-2 (the first real judged
  // step reachable from EITHER the L0 or L1 entry branch, see the file
  // header's Reward mapping note) so badge timing is consistent regardless
  // of entry point.
  onPass: { advance: "L0-2" },
  // 6-step sequence per docs/design/cogload-review-L0.md's L0-1 proposal:
  // one named storage box -> the special x0 box -> one worked addi -> a
  // low-load fill-the-immediate practice -> a result observation showing
  // the real post-run value -> a transfer-practice retrieval rep. `add`/
  // `sub` are deliberately deferred to a later level with their own worked
  // example (the review's explicit call-out against front-loading them
  // here).
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "一個有名字的箱子",
      prompt:
        "RISC-V 有 32 個**暫存器（register）**，每個都是一個能裝一個數字的箱子，而且都有名字。先認識第一個：`a0`。現在它還沒被設定過，是空的。",
      registerContext: ["a0"],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "特殊的 x0：永遠是 0",
      prompt:
        "再認識第二個箱子：`x0`。它跟 `a0` 不一樣的地方是：`x0` 永遠裝著 **0**，寫都寫不進去，之後會常常拿它當「0」用。",
      registerContext: ["x0", "a0"],
      registerLabels: { x0: "0" },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "第一行指令：addi",
      prompt:
        "`addi a0, x0, 3` 的意思是「把 **a0** 設成 **x0** 加 **3**」。指令格式固定是**「動作 目的地, 來源, 立即值」**。`x0` 是 0，所以這行等於直接把 `a0` 設成 3：",
      registerContext: ["x0", "a0"],
      registerLabels: { x0: "0" },
      registerAfter: { a0: "3" },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 5 } } },
      title: "換你填立即值",
      prompt: "跟剛剛那行一樣的指令形狀，這次把 `a0` 設成 **5**：",
      asmLines: ["addi a0, x0, {{imm}}"],
      registerContext: ["x0", "a0"],
      registerBefore: { x0: "0" },
      blanks: [{ id: "imm", answer: "5", options: ["3", "5", "7", "10"] }],
      checkRegister: "a0",
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "剛剛真的執行了",
      prompt:
        "上一步不是猜答案而已，組出來的指令真的在模擬器上跑過一次。`a0` 現在真的裝著 **5**，這是實際執行後的結果：",
      registerContext: ["a0"],
      registerAfter: { a0: "5" },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 9 } } },
      title: "再練一次同樣的形狀",
      prompt: "同樣的指令形狀，這次把 `a0` 設成 **9**：",
      asmLines: ["addi a0, x0, {{imm}}"],
      registerContext: ["x0", "a0"],
      registerBefore: { x0: "0" },
      blanks: [{ id: "imm", answer: "9", options: ["6", "8", "9", "12"] }],
      checkRegister: "a0",
    },
  ],
};

export const L0_2: LevelSchema = {
  id: "L0-2",
  title: "li／mv 其實是假指令",
  onPass: { advance: "L0-3" },
  // 6-step sequence per cogload-review-L0.md's L0-2 proposal, plus the
  // owner's two "Additional owner feedback" asks folded in: step 3 now
  // drives the RegisterBank before/after visual side-by-side for both
  // spellings (so the li/addi and mv/addi equivalence is *seen*, not
  // stated), and a 7th observation-only jal/jalr exposition screen (no
  // grading, matching the owner's "exposition, not deep practice" ask)
  // grounds `ret`'s preview from step 6 with an actual referent via
  // CodeTrace, reused ahead of L0-4's own branch content.
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "li 把一個值放進箱子",
      prompt:
        "`li a0, 5` 把 `a0` 直接設成 **5**。這是這一關認識的第一個動作：把選好的值放進一個箱子。",
      registerContext: ["a0"],
      registerAfter: { a0: "5" },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 8 } } },
      title: "換你用 li",
      prompt: "用 `li` 把 `a0` 設成 **8**：",
      asmLines: ["li a0, {{imm}}"],
      registerContext: ["a0"],
      blanks: [{ id: "imm", answer: "8", options: ["6", "8", "10", "12"] }],
      checkRegister: "a0",
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "縮寫 vs. 展開：一模一樣的結果",
      prompt:
        "CPU 實際上沒有 `li` 這個指令，組譯器會把它偷偷展開成 `addi`。把兩種寫法擺在一起看暫存器的前後狀態，一模一樣：\n\n`li a0, 5` 執行後：",
      registerContext: ["a0"],
      registerAfter: { a0: "5" },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "縮寫 vs. 展開（續）",
      prompt:
        "`addi a0, x0, 5` 執行後，跟上一步的 `li a0, 5` 完全沒有差別。這就是「為什麼可以這樣縮寫」：對 CPU 來說這兩行是同一件事，`li` 只是給人看的方便寫法，這種寫法叫**假指令（pseudo-instruction）**。",
      registerContext: ["x0", "a0"],
      registerLabels: { x0: "0" },
      registerAfter: { a0: "5" },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "mv 複製，不會清空來源",
      prompt:
        "`mv a0, a1` 把 `a1` 的值複製到 `a0`，`a1` 自己維持不變。複製前 `a1` 已經是 7、`a0` 還沒設定：",
      registerContext: ["a1", "a0"],
      registerLabels: { a1: "7" },
      registerAfter: { a1: "7", a0: "7" },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 7 } } },
      title: "用 mv 複製暫存器",
      prompt: "`a1` 已經被設成 **7**（下面看得到），用 `mv` 把它複製到 `a0`：",
      asmLines: ["li a1, 7", "mv a0, {{src}}"],
      // Options limited to registers already visible on screen (a0/a1/x0)
      // instead of introducing a2/the zero alias/ra together, per the
      // review's exact call-out against untaught distractor identities.
      setupAsmTemplate: "li a1, 7\nmv a0, {{src}}",
      checkRegister: "a0",
      registerContext: ["a1", "a0"],
      registerBefore: { a1: "7" },
      blanks: [{ id: "src", answer: "a1", options: ["a1", "a0", "x0"] }],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "跳躍：下一步不是往下一行，而是換位置",
      prompt:
        "一般指令執行完會往下一行走。**跳躍（jump）指令不一樣**：`jal ra, callee` 執行完，下一步直接換成 `callee` 這個位置，同時把「原本該回去的位置」記在 `ra`。之後看到的 `ret`，其實就是 `jalr x0, ra, 0`，跳回 `ra` 記住的那個位置：",
      codeTrace: {
        lines: [
          { id: "call", text: "jal ra, callee" },
          { id: "after-call", text: "…（呼叫者接下來的程式碼）" },
          { id: "callee", text: "…（callee 的程式碼）", label: "callee:" },
          { id: "ret", text: "ret", label: "" },
        ],
        currentLineId: "call",
        fallthroughLineId: "after-call",
        takenLineId: "callee",
      },
    },
  ],
};

export const L0_3: LevelSchema = {
  id: "L0-3",
  title: "暫存器帶不下所有東西，要跟記憶體借",
  onPass: { advance: "L0-4" },
  // 9-step sequence per cogload-review-L0.md's L0-3 proposal — the review's
  // single biggest structural change: two storage spaces -> an address is a
  // location value -> worked zero-offset load -> base practice -> word size
  // -> worked nonzero-offset load -> offset practice -> sw reverses the
  // arrow -> a final load-or-store practice. Every practice step keeps the
  // register+memory diagram it needs on screen (the review's exact
  // complaint about L0-3's old version: the hidden setup's register-to-
  // address mapping was never shown).
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "兩種儲存空間",
      prompt:
        "暫存器只有 32 個，帶不下所有東西，這時候要跟**記憶體（memory）**借空間。記憶體是一長排格子，每個格子都有自己的**位址（address）**，暫存器跟記憶體是兩種不同的儲存空間。",
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "位址本身也是一個數字",
      prompt:
        "`a1` 這個暫存器裡裝的不是 42 本身，而是**42 那個值放在哪裡的位址**。位址指向的那個記憶體格子，內容才是 42：",
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [{ offset: 0, value: "42" }],
        highlightOffset: 0,
      },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "第一次 load：lw",
      prompt:
        "`lw a0, 0(a1)` 的語法是 `offset(base)`：從 `a1` 這個位址往後 0 個 byte，把值讀進 `a0`。執行前 `a0` 是空的，執行後變成 42：",
      registerContext: ["a0"],
      registerAfter: { a0: "42" },
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [{ offset: 0, value: "42" }],
        highlightOffset: 0,
        direction: "load",
        targetRegister: "a0",
      },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 42 } } },
      title: "選出正確的 base 暫存器",
      prompt: "位址在 `a1`（下面看得到），從選項中選出補完讀值到 `a0` 的指令：",
      asmLines: ["lw a0, 0({{base}})"],
      // a2 points at a *different* known word so picking it is a distinct
      // wrong outcome (a0 ends at 17, not 42) rather than a crash — and
      // deliberately not offered as a0 itself, since a0 is this step's load
      // destination and reusing it as a base-register distractor would ask
      // the learner to juggle operand role vs. permanent register identity
      // in the same instruction (see the review's exact call-out on this).
      setupAsmTemplate:
        "la a1, __l03_correct\nla a2, __l03_wrong\nlw a0, 0({{base}})",
      probeExtraData: "__l03_correct: .word 42\n__l03_wrong: .word 17",
      checkRegister: "a0",
      // a2 shown too (as "→ 別的位址", no value drawn) so the option is
      // answerable purely from what's on screen rather than asking the
      // learner to recall an undisplayed register's identity — see the
      // review's L0-3 step 4 note "use only registers whose current
      // contents are displayed."
      registerContext: ["a1", "a2", "a0"],
      registerBefore: { a2: "→ 別的位址" },
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [{ offset: 0, value: "42" }],
        highlightOffset: 0,
      },
      blanks: [{ id: "base", answer: "a1", options: ["a1", "a2"] }],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "一個 word 佔 4 個 byte",
      prompt:
        "記憶體格子的大小是 byte，但 `lw`／`sw` 一次讀寫 **4 個 byte（一個 word）**。下一格（offset 4）是一塊獨立的 4-byte 區域：",
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [
          { offset: 0, value: "42" },
          { offset: 4, value: "17" },
        ],
        highlightOffset: 4,
      },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "非 0 的 offset",
      prompt:
        "`lw a0, 4(a1)` 從 `a1` 往後跳 **4 個 byte** 再讀，讀到的是隔壁那個 word（17），不是 `a1` 本身指到的那格：",
      registerContext: ["a0"],
      registerAfter: { a0: "17" },
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [
          { offset: 0, value: "42" },
          { offset: 4, value: "17" },
        ],
        highlightOffset: 4,
        direction: "load",
        targetRegister: "a0",
      },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 17 } } },
      title: "選出正確的 offset",
      prompt:
        "位址在 `a1`，目標格子是 offset **4** 那格（17），選出正確的 offset：",
      asmLines: ["lw a0, {{offset}}(a1)"],
      setupAsmTemplate: "la a1, __l03_off_base\nlw a0, {{offset}}(a1)",
      probeExtraData: "__l03_off_base: .word 42\n.word 17",
      checkRegister: "a0",
      registerContext: ["a1", "a0"],
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [
          { offset: 0, value: "42" },
          { offset: 4, value: "17" },
        ],
        highlightOffset: 4,
      },
      // Only offsets that are actually visible on screen (the memoryVisual
      // above shows cells at +0 and +4 only) — an untaught +8 distractor
      // would ask the learner to guess at memory that was never drawn, the
      // exact "un-answerable from displayed info" pattern the design
      // principles doc calls out.
      blanks: [{ id: "offset", answer: "4", options: ["0", "4"] }],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "sw 反過來：從暫存器寫進記憶體",
      prompt:
        "`sw a0, 0(a1)` 跟 `lw` 方向相反：把 `a0` 的值寫進 `a1` 指到的格子。執行前那格是空的，執行後變成 `a0` 的值（9）：",
      registerContext: ["a0"],
      registerLabels: { a0: "9" },
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [{ offset: 0, value: "9" }],
        highlightOffset: 0,
        direction: "store",
        targetRegister: "a0",
      },
    },
    {
      widgetType: "fill-blank",
      // A store step stays register-judged with the existing engine per the
      // review's exact implementation note: load the just-stored word back
      // into a probe register afterward instead of adding a memory-
      // expectation shape to the judge schema.
      judge: { kind: "emulator", expect: { registers: { a2: 9 } } },
      title: "選 lw 還是 sw",
      prompt:
        "把 `a0`（已經是 9）寫進 `a1` 指到的格子，從選項中選出正確的指令：",
      asmLines: ["{{op}} a0, 0(a1)"],
      setupAsmTemplate:
        "li a0, 9\nla a1, __l03_store_target\n{{op}} a0, 0(a1)\nlw a2, 0(a1)",
      probeExtraData: "__l03_store_target: .word 0",
      checkRegister: "a2",
      registerContext: ["a0", "a1"],
      registerBefore: { a0: "9" },
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [{ offset: 0 }],
        highlightOffset: 0,
        direction: "store",
        targetRegister: "a0",
      },
      blanks: [{ id: "op", answer: "sw", options: ["lw", "sw"] }],
    },
  ],
};

export const L0_4: LevelSchema = {
  id: "L0-4",
  title: "分支：比較跟跳轉是同一個指令做完的",
  onPass: { advance: "L1-1" },
  // 7-step sequence per cogload-review-L0.md's L0-4 proposal: normal
  // execution moves down -> a label names a destination -> a branch forks
  // into two next-locations -> a worked beq -> a beq practice -> bne
  // reuses the same diagram -> a final beq-or-bne practice. `blt`/`bge`
  // stay deferred (no downstream use yet, per the review). syscall/
  // "vulnerable binary" framing is deliberately kept out — that's L1/L2
  // vocabulary, not needed to form the branch model itself.
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "一般執行：往下一行走",
      prompt:
        "正常情況下，CPU 執行完一行指令，下一步就是往下一行走。三行連續指令，執行順序就是由上到下：",
      codeTrace: {
        lines: [
          { id: "l1", text: "addi a0, x0, 1" },
          { id: "l2", text: "addi a1, x0, 2" },
          { id: "l3", text: "addi a2, x0, 3" },
        ],
        currentLineId: "l1",
      },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "標籤（label）幫一行指令取名字",
      prompt:
        "**標籤（label）**是幫某一行指令取的名字，寫成 `名字:`。它本身不是指令，只是讓其他指令可以用名字指向這一行，這裡 `target:` 指向的就是第 3 行：",
      codeTrace: {
        lines: [
          { id: "l1", text: "addi a0, x0, 1" },
          { id: "l2", text: "addi a1, x0, 2" },
          { id: "l3", text: "addi a2, x0, 3", label: "target:" },
        ],
      },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "分支：兩個可能的下一步",
      prompt:
        "**分支（branch）指令會二選一**：條件成立就跳到標籤那行，不成立就照常往下一行走。兩條路都畫出來，先不管是哪個指令、哪種條件：",
      codeTrace: {
        lines: [
          { id: "br", text: "b?? a0, a1, target" },
          { id: "fall", text: "addi a2, x0, 0" },
          { id: "target", text: "addi a2, x0, 9", label: "target:" },
        ],
        currentLineId: "br",
        fallthroughLineId: "fall",
        takenLineId: "target",
      },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "第一個分支指令：beq",
      prompt:
        "`beq a0, a1, target` **相等（equal）就跳**。這裡 `a0 = 5`、`a1 = 5`，相等，所以跳到 `target`，中間那行被跳過：",
      registerContext: ["a0", "a1"],
      registerLabels: { a0: "5", a1: "5" },
      codeTrace: {
        lines: [
          { id: "br", text: "beq a0, a1, target" },
          { id: "fall", text: "addi a2, x0, 0" },
          { id: "target", text: "addi a2, x0, 9", label: "target:" },
        ],
        currentLineId: "br",
        fallthroughLineId: "fall",
        takenLineId: "target",
        executedPath: "taken",
      },
    },
    {
      widgetType: "fill-blank",
      // Marker register a2 ends at 9 only if beq actually took the jump
      // (matching the worked example just shown) — a wrong pick either
      // fails to assemble meaningfully or leaves a2 at the fall-through
      // value (0), same "distinct real outcome" pattern as L0-1..L0-3.
      judge: { kind: "emulator", expect: { registers: { a2: 9 } } },
      title: "換你判斷 beq 會不會跳",
      prompt: "`a0 = 5`、`a1 = 5`，選出讓程式跳到 `target` 的比較指令：",
      asmLines: ["{{op}} a0, a1, target"],
      setupAsmTemplate:
        "li a0, 5\nli a1, 5\n{{op}} a0, a1, target\naddi a2, x0, 0\njal x0, __l04_done\ntarget:\naddi a2, x0, 9\n__l04_done:",
      checkRegister: "a2",
      registerContext: ["a0", "a1"],
      registerBefore: { a0: "5", a1: "5" },
      codeTrace: {
        lines: [
          { id: "br", text: "{{op}} a0, a1, target" },
          { id: "fall", text: "addi a2, x0, 0" },
          { id: "target", text: "addi a2, x0, 9", label: "target:" },
        ],
        currentLineId: "br",
        fallthroughLineId: "fall",
        takenLineId: "target",
        executedPath: "taken",
      },
      blanks: [{ id: "op", answer: "beq", options: ["beq", "bne"] }],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "bne：只換了條件",
      prompt:
        "`bne a0, a1, target` **不相等（not equal）就跳**，跟 `beq` 只差一個字。這裡 `a0 = 5`、`a1 = 7`，不相等，所以一樣跳到 `target`：",
      registerContext: ["a0", "a1"],
      registerLabels: { a0: "5", a1: "7" },
      codeTrace: {
        lines: [
          { id: "br", text: "bne a0, a1, target" },
          { id: "fall", text: "addi a2, x0, 0" },
          { id: "target", text: "addi a2, x0, 9", label: "target:" },
        ],
        currentLineId: "br",
        fallthroughLineId: "fall",
        takenLineId: "target",
        executedPath: "taken",
      },
    },
    {
      widgetType: "fill-blank",
      // a0 != a1 here (5 vs 7): only bne takes the jump to target (a2 = 9);
      // beq would fall through (a2 stays 0), so this exercises the opposite
      // condition from the previous practice step with the same diagram.
      judge: { kind: "emulator", expect: { registers: { a2: 9 } } },
      title: "選出跳到 target 的指令",
      prompt: "`a0 = 5`、`a1 = 7`，選出讓程式跳到 `target` 的比較指令：",
      asmLines: ["{{op}} a0, a1, target"],
      setupAsmTemplate:
        "li a0, 5\nli a1, 7\n{{op}} a0, a1, target\naddi a2, x0, 0\njal x0, __l04_done\ntarget:\naddi a2, x0, 9\n__l04_done:",
      checkRegister: "a2",
      registerContext: ["a0", "a1"],
      registerBefore: { a0: "5", a1: "7" },
      codeTrace: {
        lines: [
          { id: "br", text: "{{op}} a0, a1, target" },
          { id: "fall", text: "addi a2, x0, 0" },
          { id: "target", text: "addi a2, x0, 9", label: "target:" },
        ],
        currentLineId: "br",
        fallthroughLineId: "fall",
        takenLineId: "target",
        executedPath: "taken",
      },
      blanks: [{ id: "op", answer: "bne", options: ["beq", "bne"] }],
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 1 — Calling Convention
// ---------------------------------------------------------------------------

// 8-step sequence per docs/design/cogload-review-L1.md's L1-1 proposal
// (infer-don't-tell: 2-3 worked examples before any rule is stated, then a
// retrieval step, then real emulator-graded practice), extended per the
// content-redesign brief to also give L1-1 genuine graded practice (the
// review's own proposal only reached direct-judge retrieval taps, never an
// actual assemble+run) and a merged checkpoint that requires two already-
// taught registers at once — the platform-wide gap
// docs/design/level-design-principles.md calls out ("L1 從頭到尾沒有任何一步
// 要求同時填 a0 又填 a7"). Scope stays L1-1-only: ordinary function calls,
// no syscall/a7-number framing (L1-2), no fd (L1-3), no ra/sp (L1-4).
//
// 1. observation — bare framing, no rule stated yet (a0-a7 exist as a
//    group), full 8-box bank with no values: sets up "watch for the
//    pattern" before any example.
// 2. observation — worked example 1, sum2(3, 5) -> a0=3, a1=5, before/after
//    RegisterBank transition scoped to just a0/a1.
// 3. observation — worked example 2, sum3(2, 4, 6) -> a0=2, a1=4, a2=6,
//    scoped to a0-a2. A second, differently-shaped call so the pattern
//    (not a one-off fact) is what repeats.
// 4. fill-blank, judge:"direct" — first-practice retrieval: given the
//    pattern from steps 2-3, predict the register for an unseen 4th
//    position (pack4's x4). No emulator run needed — this tests the
//    positional rule itself, not code execution.
// 5. fill-blank, judge:"emulator" — first real assemble+run practice:
//    place pair()'s 2nd argument into its correct register. Single
//    checkRegister, same pattern L1-2 already uses for a fixed-value
//    register-name pick.
// 6. fill-blank, judge:"emulator", 2 blanks/2 registers — the merged
//    checkpoint: sum2(3, 5) again (callback to step 2), but this time the
//    learner must place *both* arguments correctly in the same program;
//    checkRegister: ["a0", "a1"] only passes if both picks are right (see
//    registerProbe.ts's multi-register probe support added for this step).
// 7. observation — return-value beat, kept separate from the argument
//    bloc per the review's explicit split: the answer also travels through
//    a0, but that's a distinct fact from "arguments go in a0.. in order."
// 8. fill-blank, judge:"emulator" — return-value register retrieval, real
//    assemble+run (same single-checkRegister pattern as step 5).
export const L1_1: LevelSchema = {
  id: "L1-1",
  title: "a0–a7：你跟外界溝通的管道",
  onPass: { advance: "L1-2" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "a0–a7：你跟外界溝通的管道",
      prompt:
        "呼叫函式的時候，引數要怎麼從呼叫者手上交給函式？RISC-V 保留了 `a0`–`a7`（也就是 `x10`–`x17`）這 8 個暫存器，專門用來傳遞引數和回傳值。先不談 `ra`／`sp`，只看這 8 個。接下來看兩個實際呼叫的例子，找出引數放置的規律。",
      registerContext: ["a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7"],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "範例一：兩個引數",
      prompt: "呼叫 `sum2(3, 5)` 前，呼叫者把兩個引數依序放進暫存器：",
      registerContext: ["a0", "a1"],
      registerAfter: { a0: "3", a1: "5" },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "範例二：三個引數",
      prompt: "再看一個引數更多的呼叫，`sum3(2, 4, 6)`：",
      registerContext: ["a0", "a1", "a2"],
      registerAfter: { a0: "2", a1: "4", a2: "6" },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "direct" },
      title: "找出規律",
      prompt:
        "兩個例子都一樣：第 1 個引數放 `a0`，第 2 個放 `a1`，第 3 個放 `a2`，依序往後排。照這個規律，呼叫 `pack4(x1, x2, x3, x4)` 時，第 4 個引數 `x4` 會放進哪個暫存器？",
      blanks: [{ id: "pos4", answer: "a3", options: ["a2", "a3", "a4", "a7"] }],
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a1: 11 } } },
      title: "把引數放進正確的暫存器",
      prompt:
        "呼叫 `pair(6, 11)`，把第 2 個引數 `11` 放進正確的暫存器。這次是真的組譯執行，選對才會通過判定。",
      asmLines: ["li {{reg}}, 11   # 第 2 個引數 = 11"],
      setupAsmTemplate: "li {{reg}}, 11",
      checkRegister: "a1",
      blanks: [{ id: "reg", answer: "a1", options: ["a0", "a1", "a2", "a7"] }],
      registerContext: ["a0", "a1", "a2", "a7"],
    },
    {
      widgetType: "fill-blank",
      judge: {
        kind: "emulator",
        expect: { registers: { a0: 3, a1: 5 } },
      },
      title: "同時放對兩個引數",
      prompt:
        "呼叫 `sum2(3, 5)`。這次換你把兩個引數都放進正確的暫存器，兩個都要對才會通過判定。",
      asmLines: [
        "li {{reg0}}, 3   # 第 1 個引數 = 3",
        "li {{reg1}}, 5   # 第 2 個引數 = 5",
      ],
      setupAsmTemplate: "li {{reg0}}, 3\nli {{reg1}}, 5",
      checkRegister: ["a0", "a1"],
      blanks: [
        { id: "reg0", answer: "a0", options: ["a0", "a1", "a2", "a7"] },
        { id: "reg1", answer: "a1", options: ["a0", "a1", "a2", "a7"] },
      ],
      registerContext: ["a0", "a1", "a2", "a7"],
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "回傳值也走同一條路",
      prompt:
        "引數是呼叫者放進暫存器給函式讀；函式算完之後，答案要怎麼傳回去？一樣借用同一組管道：**回傳值放進 `a0`**。假設 `square(4)` 算出 `16`，函式回傳前會把 `16` 放進 `a0`。",
      registerContext: ["a0"],
      registerAfter: { a0: "16" },
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 20 } } },
      title: "回傳值放進哪裡？",
      prompt: "函式算出答案是 `20`，要放進哪個暫存器，呼叫者才讀得到？",
      asmLines: ["li {{reg}}, 20   # 回傳值 = 20"],
      setupAsmTemplate: "li {{reg}}, 20",
      checkRegister: "a0",
      blanks: [{ id: "reg", answer: "a0", options: ["a0", "a1", "a7", "ra"] }],
      registerContext: ["a0", "a1", "a7", "ra"],
    },
  ],
};

export const L1_2: LevelSchema = {
  id: "L1-2",
  title: "syscall number 放哪個暫存器？",
  onPass: { advance: "L1-3", reward: "hitcon-badge" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "syscall 也是一種函式呼叫",
      prompt:
        "syscall（跟系統要服務）沒有另一套規則，直接借用 L1-1 剛認識的 `a0`–`a7`：**`a7` 放「你想要哪個服務」的編號**，`a0`–`a6` 當這個服務的參數。想印字（`write`）就要告訴系統：\n- 要寫到哪個檔案（`fd`）\n- 字串在哪裡（`buf`）\n- 多長（`len`）\n\n這三個放進 `a0`/`a1`/`a2`，而 `a7` 先放 `write` 這個服務本身的編號。",
      registerContext: ["a0", "a1", "a2", "a7"],
      registerLabels: {
        a0: "fd（寫到哪）",
        a1: "buf（字串位址）",
        a2: "len（長度）",
        a7: "syscall 編號",
      },
    },
    {
      widgetType: "fill-blank",
      // Real emulator+register-probe judging (same L0-1..L0-3 pattern) — see
      // level-review-L1.md §0 Addition 1: this used to be judge:"direct", a
      // pure string-equality check on the picked option that never actually
      // assembled/ran anything, despite visually presenting real asm as if
      // it were being executed. `ecall` is left out of setupAsmTemplate
      // (kept only in the displayed asmLines for narrative continuity, same
      // asymmetry L0-2 already uses) so wrong picks don't trigger a real
      // syscall with unset a0/a1/a2 — checkRegister only cares whether a7
      // actually ended up holding 64.
      judge: { kind: "emulator", expect: { registers: { a7: 64 } } },
      setupAsmTemplate: "li {{a7}}, 64",
      checkRegister: "a7",
      title: "syscall number 放哪個暫存器？",
      prompt:
        "你想跟系統要哪個服務？呼叫 `read`/`write`/`exit` 前，系統呼叫編號要放進哪個暫存器？（挑 `write` 的 syscall 編號）",
      asmLines: ["li {{a7}}, 64   # write 的 syscall number", "ecall"],
      blanks: [{ id: "a7", answer: "a7", options: ["a0", "a1", "a7", "ra"] }],
      registerContext: ["a0", "a1", "a7", "ra"],
    },
  ],
};

export const L1_3: LevelSchema = {
  id: "L1-3",
  title: "write 要知道寫到哪裡",
  onPass: { advance: "L1-4" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "fd：寫到哪個檔案",
      prompt:
        "`write` 光有 `a7=64`（「我要 write 這個服務」）還不夠——系統還要知道「寫到哪裡」。這個「哪裡」用一個小整數代表，叫 **file descriptor（fd）**：\n- `0` 是 stdin（標準輸入）\n- `1` 是 stdout（標準輸出，螢幕會看到的地方）\n- `2` 是 stderr（錯誤訊息）\n\n這個約定放進 `write` 的 `a0` 參數裡。",
      registerContext: ["a0", "a7"],
      registerLabels: {
        a0: "fd（0=stdin/1=stdout/2=stderr）",
        a7: "64（write，已固定）",
      },
    },
    {
      widgetType: "fill-blank",
      // Real emulator+register-probe judging — see L1-2's identical comment
      // above (level-review-L1.md §0 Addition 1). `li a7, 64` / `ecall` stay
      // in the displayed asmLines but are dropped from setupAsmTemplate for
      // the same reason: checkRegister only cares whether a0 ended up 1.
      //
      // No registerContext here (unlike L1-1/L1-2/L1-4) — the repo owner
      // flagged that a RegisterBank next to asmLines with an inline blank is
      // redundant: picking an option already updates the code line itself
      // ("li a0, 1"), so a register box just echoing the same pick with a1/
      // a7 sitting permanently empty adds nothing, it was the exact "decoy
      // box" pattern cogload-review-L1.md's RegisterBank finding calls out.
      judge: { kind: "emulator", expect: { registers: { a0: 1 } } },
      setupAsmTemplate: "li a0, {{a0}}",
      checkRegister: "a0",
      title: "write 要知道寫到哪裡",
      prompt:
        "把 `a0` 設成 **1**（stdout）。L1-2 加上 L1-3，就等於原本一次到位的目標，過關瞬間已經站在 Level 2 門口。",
      asmLines: ["li a0, {{a0}}   # 1 = stdout", "li a7, 64", "ecall"],
      blanks: [{ id: "a0", answer: "1", options: ["0", "1", "2", "64"] }],
    },
  ],
};

export const L1_4: LevelSchema = {
  id: "L1-4",
  title: "ra 與 sp：先混個眼熟",
  onPass: { advance: "L2-0" },
  // No reward — the repo owner's explicit L1-2 reward decision (see file
  // header) stays as-is; this level gains real interaction (see
  // level-review-L1.md 5.1/5.2), not a new reward-granting checkpoint.
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "ra 與 sp：先混個眼熟",
      prompt:
        "- `ra`（`x1`，return address）：呼叫函式的 `jal` 會把「呼叫指令的下一行位址」記進 `ra`，函式結束時的 `ret`（其實是 `jalr x0, ra, 0` 這個假指令）就是跳回 `ra` 記住的那個位址。\n- `sp`（`x2`）：堆疊指標，先混眼熟——Boss 分支的整個 stack 佈局會直接用到。\n\n`sp` 現在不考，但 `ra` 現在就練一次：誰記得要跳回哪。",
      registerContext: ["ra", "sp"],
      registerLabels: {
        ra: "return address，跳回哪",
        sp: "堆疊指標",
      },
    },
    {
      widgetType: "fill-blank",
      // Real emulator+register-probe judging, same L0-1..L0-3/L1-2/L1-3
      // pattern — this is L1-4's new practice step (level-review-L1.md's
      // top-priority fix: ra was the only named ABI register in the whole
      // platform's stated minimum bar with zero assessment inside the
      // booth-scoped flow). `jal {{rd}}, __l14_after` always jumps to the
      // very next instruction regardless of which register the player
      // picks (the jump *target* is fixed by the label; only the *link*
      // register differs), so every option is safe to actually execute —
      // no risk of a wrong pick landing on an unmapped address. Only a
      // correct pick (rd=ra) leaves `ra` holding the real link address
      // (BASE_ADDRESS + 4, the address of the instruction right after the
      // jal); any other pick leaves `ra` at its untouched reset value (0),
      // which genuinely fails the check.
      judge: {
        kind: "emulator",
        expect: { registers: { ra: BASE_ADDRESS + 4 } },
      },
      setupAsmTemplate: "jal {{rd}}, __l14_after\n__l14_after:",
      checkRegister: "ra",
      title: "誰記得要跳回哪？",
      prompt:
        "`jal` 呼叫函式時，會把「跳過去之前的下一行位址」記錄下來，這樣函式做完 `ret` 才知道要跳回哪。哪個暫存器負責記住這個返回位址？",
      asmLines: [
        "jal {{rd}}, func   # 呼叫 func",
        "func:",
        "    ret              # 跳回呼叫者",
      ],
      blanks: [{ id: "rd", answer: "ra", options: ["ra", "sp", "a0", "t0"] }],
      registerContext: ["ra", "sp", "a0", "t0"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 2 — Shellcode by Hand
// ---------------------------------------------------------------------------

export const L2_0: LevelSchema = {
  id: "L2-0",
  title: "syscall 沒有另一套規則",
  onPass: { advance: "L2-1" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "syscall 沒有另一套規則",
      prompt:
        "直接借用 calling convention：`a7` 放服務編號，`a0`–`a6` 當參數：\n- `write(a7=64, a0=fd, a1=buf, a2=len)`\n- `open(a7=1024, a0=path, a1=flags)`\n- `read(a7=63, a0=fd, a1=buf, a2=len)`\n\n冷知識：`open` 的編號是 **1024**，不是常見 Linux 系統上的 `openat`（56）——rv32emu 的精簡 syscall table 只實作了 `open`，沒有 `openat`。",
    },
  ],
};

export const L2_1: LevelSchema = {
  id: "L2-1",
  title: "寫出你的第一個 syscall",
  onPass: { advance: "L2-2", reward: "ttussc-merch" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "回顧 write 的簽名",
      prompt:
        "`write(a7=64, a0=fd, a1=buf, a2=len)` —— `a7`／`a0` 這一步已經幫你固定好了（`a7=64` 是 write，`a0=1` 是 stdout），剩下 `a1`（字串在哪）跟 `a2`（多長）要換你自己填。目標：湊出一段真的丟進 rv32emu 執行、印出 **HI** 的 shellcode。",
      registerContext: ["a7", "a0", "a1", "a2"],
      registerLabels: {
        a7: "64（write，已固定）",
        a0: "1（stdout，已固定）",
        a1: "？字串位址",
        a2: "？長度",
      },
    },
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "標籤也能指到記憶體位置",
      prompt:
        "L0 教過標籤幫一行指令取名字，同樣的道理，標籤也可以幫記憶體裡的一塊資料取名字。這裡的 `msg` 就是這麼一個標籤，指向存著「HI」這兩個字元的位置。`la a1, msg`（load address）會把 `msg` 實際的位址算出來放進 `a1`，你完全不用知道那個位址是多少，`la` 幫你算好了。",
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [
          { offset: 0, value: "H", label: "msg" },
          { offset: 1, value: "I" },
        ],
        bytesPerCell: 1,
        highlightOffset: 0,
      },
    },
    {
      widgetType: "drag-fill",
      judge: { kind: "emulator", expect: { stdout: "HI" } },
      title: "拖曳指令組出 write",
      prompt:
        "拖曳指令進 `a1`／`a2`，組出一段能印出 **HI** 的 shellcode。`a1` 要放能拿到 `msg` 位址的那行指令，不是你自己猜的數字。",
      memoryVisual: {
        baseRegister: "a1",
        baseValue: "→",
        cells: [
          { offset: 0, value: "H", label: "msg" },
          { offset: 1, value: "I" },
        ],
        bytesPerCell: 1,
        highlightOffset: 0,
      },
      slots: [
        {
          id: "a1",
          label: "字串位址",
          options: ["la a1, msg", "li a1, 0x20000", "mv a1, a0"],
          answer: "la a1, msg",
          // The options are the actual instruction text now, not opaque hex
          // numbers — `optionAsm` matches its displayed label exactly, so
          // there's no more silently-wrong mapping between what's shown and
          // what runs (cogload-review-L2.md finding #2). "la a1, msg" is the
          // only one that ever points a1 at the real (assembler-resolved)
          // address of `msg` — the correct behavior never requires knowing
          // that number, matching the previous step's point. "li a1,
          // 0x20000" is a literal into unmapped memory (this program's
          // actual footprint stays well under that address), so it crashes
          // on the write syscall instead of printing. "mv a1, a0" copies
          // a0's value at this point in the program — a0 hasn't been set to
          // the stdout fd yet (that happens later, in asmSuffix's "li a0,
          // 1"), so a0 is still its reset value (0), and a1 ends up
          // pointing at unmapped low memory — also a crash, not a silent
          // wrong-but-passing output.
          optionAsm: {
            "la a1, msg": "la a1, msg",
            "li a1, 0x20000": "li a1, 0x20000",
            "mv a1, a0": "mv a1, a0",
          },
        },
        {
          id: "a2",
          label: "長度",
          options: ["1", "2", "4"],
          answer: "2",
          optionAsm: {
            "1": "li a2, 1",
            "2": "li a2, 2",
            "4": "li a2, 4",
          },
        },
      ],
      asmPrefix: "_start:\n",
      // Slot asm sets a1/a2; this does the actual write(1, a1, a2) with the
      // student's chosen values, then an unconditional trailing newline
      // write — required so rv32emu's line-buffered stdout (Module.print
      // only flushes a *completed* line) actually surfaces the "HI" text at
      // all; verified end-to-end against the real WASM build (see
      // assembler/registerProbe.ts's header for the same gotcha).
      // Module.print reports the line without its trailing "\n", so the
      // judge's exact-match "HI" still holds.
      asmSuffix:
        "    li a0, 1\n" +
        "    li a7, 64\n" +
        "    ecall\n" +
        "    la a1, __nl\n" +
        "    li a2, 1\n" +
        "    li a0, 1\n" +
        "    li a7, 64\n" +
        "    ecall\n" +
        "    li a0, 0\n" +
        "    li a7, 93\n" +
        "    ecall\n" +
        ".data\n" +
        'msg: .ascii "HI"\n' +
        "__nl: .byte 10\n",
    },
  ],
};

export const L2_2: LevelSchema = {
  id: "L2-2",
  title: "排出正確的 ORW 順序",
  onPass: { advance: "L2-3" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "三個 syscall 接力：fd 會傳給下一個",
      prompt:
        "`open(a7=1024, a0=path, a1=flags)` 執行完，回傳值（新開檔案的 `fd`）會放在 `a0` 裡——下一個 `read(a7=63, a0=fd, a1=buf, a2=len)` 就要用這個 `fd`，不是隨便寫死一個數字。同樣地，`write(a7=64, a0=fd, a1=buf, a2=len)` 印出的東西，就是 `read` 剛剛讀進 `buf` 的內容。**三個 syscall 是接力賽，順序錯了，後面拿到的值就是垃圾。**",
    },
    {
      widgetType: "drag-order",
      // Real end-to-end open->read->write against a preloaded flag.txt (see
      // `files` below) — not the real event flag (that mechanism is
      // separately unresolved, tracked in levels.md 待驗證/待辦), just real
      // enough demo content to prove the ORW mechanics actually work: a
      // wrong drag order genuinely fails (missing fd / garbage buf / wrong
      // syscall number), a correct order genuinely prints it.
      judge: { kind: "emulator", expect: { stdoutContains: "TTUSSC{demo}" } },
      title: "排出正確的 ORW 順序",
      prompt:
        "給正確但打散的 `open`／`read`／`write` 片段（用 L2-0 已預覽過的三個 syscall），拖曳排回順序。",
      items: [
        {
          id: "open-a7",
          label: "li a7, 1024   # open syscall number",
          asm: "    li a7, 1024",
        },
        {
          id: "open-a0",
          label: "la a0, path    # 檔名位址",
          asm: "    la a0, path",
        },
        {
          id: "open-ecall",
          label: "ecall          # 執行 open",
          // a0 <- fd on return.
          asm: "    ecall",
        },
        {
          id: "read-a7",
          label: "li a7, 63     # read syscall number",
          // a1/a2 (buf/len) aren't being taught by this step (that's
          // L1-2/L1-3's job) — bundled here, right before read's own ecall,
          // so a wrong drag order still genuinely breaks (e.g. dragging this
          // before open leaves a0 without a real fd).
          asm: "    li a7, 63\n    la a1, buf\n    li a2, 13",
        },
        {
          id: "read-ecall",
          label: "ecall          # 執行 read",
          // a0 <- bytes read on return.
          asm: "    ecall",
        },
        {
          id: "write-a7",
          label: "li a7, 64     # write syscall number",
          // a1/a2 already point at buf/len from the read step above; only
          // a0 needs to switch from "the opened file's fd" to stdout (1).
          asm: "    li a7, 64\n    li a0, 1",
        },
        {
          id: "write-ecall",
          label: "ecall          # 執行 write",
          asm: "    ecall",
        },
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
      asmPrefix: "_start:\n",
      asmSuffix:
        "\n    li a0, 0\n" +
        "    li a7, 93\n" +
        "    ecall\n" +
        ".data\n" +
        'path: .asciz "flag.txt"\n' +
        "buf: .space 16\n",
      // Preloaded into the emulator's virtual FS before running (see
      // emulatorAdapter.ts's RunRequest.files) — this is what makes open()
      // a real syscall against a real file instead of failing on a missing
      // path.
      files: [{ path: "flag.txt", contents: "TTUSSC{demo}\n" }],
    },
  ],
};

export const L2_3: LevelSchema = {
  id: "L2-3",
  title: "填出正確的 syscall 編號",
  onPass: { advance: "L2-4" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "四個編號，四個服務",
      prompt:
        "rv32emu 是 newlib/riscv-pk 風格的精簡 syscall table，這條技能樹會用到的編號只有四個：\n- `open` = 1024\n- `read` = 63\n- `write` = 64\n- `exit` = 93\n\n骨架已經幫你搭好 `li a7, ___` 跟 `ecall`，這步只考「印出東西該填哪個編號」。",
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "direct" },
      title: "填出正確的 syscall 編號",
      prompt:
        "給有洞的骨架（`li a7, ___` / `ecall` 結構都在），從有限選項填暫存器名稱或立即值。目標是印出 `write` 的結果。",
      blanks: [
        { id: "a7value", answer: "64", options: ["1024", "63", "64", "93"] },
      ],
    },
  ],
};

export const L2_4: LevelSchema = {
  id: "L2-4",
  title: "填出完整 ORW 的 syscall",
  onPass: { advance: "L2-5a" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "沒教過的語法先幫你寫好，重點才是你要填的",
      prompt:
        '這關不是要你從零刻出整支程式——`.data` 段、字串宣告、`_start:` 標籤這些語法課程從來沒教過，不是這個技能樹的重點，所以已經幫你寫好：\n- `.data` 段放好 `path: .asciz "flag.txt"` 跟 `buf: .space 16`\n- `_start:` 標籤\n- `open` 這個新 syscall 已經當範例整段寫完，包含拿到 `fd` 後 `mv s1, a0` 存起來（L2-2／L2-3 用過的保護寫法，避免下一個 syscall 把 `a0` 蓋掉）\n\n真正要你自己寫的，是 `read`／`write`／`exit` 各自的 `li a7, N`（syscall 編號）跟參數暫存器（`a0`／`a1`／`a2`）——這才是「syscall + 參數準備」這個技能真正在練的部分。起始碼裡每個要填的地方都有 `# TODO` 註解標好位置。',
    },
    {
      widgetType: "freehand-editor",
      judge: { kind: "emulator", expect: { stdoutContains: "TTUSSC{demo}" } },
      title: "填出完整 ORW 的 syscall",
      prompt:
        "`open` 已經幫你示範完整寫法，換你接著把 `read` → `write` → `exit` 的 syscall 編號跟參數暫存器補上去——照 `# TODO` 註解填，`.data`／`_start:` 這些骨架都不用動。",
      starterCode:
        ".text\n" +
        "_start:\n" +
        '    # ---- open("flag.txt") ----（已示範完整寫法）\n' +
        "    li a7, 1024\n" +
        "    la a0, path\n" +
        "    ecall\n" +
        "    mv s1, a0          # fd 存到 s1，避免被下一個 syscall 蓋掉\n" +
        "\n" +
        "    # ---- read(fd, buf, len) ----\n" +
        "    # TODO: 填出 read 的 syscall 編號（a7）\n" +
        "    # TODO: a0 = fd（用剛剛存的 s1）\n" +
        "    # TODO: a1 = buf 的位址\n" +
        "    # TODO: a2 = 長度（flag.txt 內容是 13 bytes，含換行）\n" +
        "\n" +
        "    # ---- write(1, buf, len) ----\n" +
        "    # TODO: 填出 write 的 syscall 編號（a7）\n" +
        "    # TODO: a0 = 1（stdout）\n" +
        "    # TODO: a1 = buf 的位址\n" +
        "    # TODO: a2 = 長度\n" +
        "\n" +
        "    # ---- exit(0) ----\n" +
        "    # TODO: 填出 exit 的 syscall 編號（a7）\n" +
        "    # TODO: a0 = 0\n" +
        "\n" +
        ".data\n" +
        'path: .asciz "flag.txt"\n' +
        "buf: .space 16\n",
      // Same demo flag content as L2-2's fix (see that level's `files`
      // comment) — real end-to-end open->read->write against a preloaded
      // flag.txt, not the real event flag (still unresolved, see
      // levels.md 待驗證/待辦).
      files: [{ path: "flag.txt", contents: "TTUSSC{demo}\n" }],
    },
  ],
};

export const L2_5A: LevelSchema = {
  id: "L2-5a",
  title: "滑到剛好蓋到 ra 的 offset",
  onPass: { advance: "L2-5b" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "buffer 後面藏著 saved ra",
      prompt:
        "這支 binary 有一個固定大小的 **buffer（32 bytes）** 接收輸入，緊接著往高位址排著：\n- `saved s0`（函式進入時存的舊 frame pointer，4 bytes）\n- `saved ra`（函式怎麼記得要跳回哪，4 bytes）\n\n函式結束時的 `ret` 其實是 `jalr x0, ra, 0` 這條假指令——直接跳到 `ra` 存的位址。輸入**沒有邊界檢查**，寫超過 32 bytes 就會一路蓋過 `saved s0`，蓋到 `saved ra`，讓函式 return 的時候跳到你指定的地方。",
      // Static illustration of the layout, filled right up to where saved ra
      // begins (buffer + saved s0) — shows the "about to overwrite ra" point
      // this step's prose is building up to, before the next step's live
      // slider lets the player find the exact offset themselves.
      stackVisual: {
        bufferSize: 32,
        mode: "offset",
        savedS0Size: 4,
        savedRaSize: 4,
        fillLength: 36,
      },
    },
    {
      widgetType: "lever-slider",
      judge: { kind: "direct" },
      title: "滑到剛好蓋到 ra 的 offset",
      prompt:
        "拖曳輸入長度滑桿，即時視覺化 `buffer` → `saved s0` → `saved ra` 被吃掉的過程，滑到**剛好蓋到 ra** 的 offset。",
      min: 0,
      max: 64,
      // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
      target: 40,
      // Stack shape matches the target above: 32-byte buffer + 4-byte saved
      // s0 means offset 36 is where saved ra begins, but the "just right"
      // answer is framed as "剛好蓋到 ra" so target sits right at that
      // boundary + 4 slack; adjust alongside target once the real test ELF
      // lands.
      stackVisual: {
        bufferSize: 32,
        mode: "offset",
        savedS0Size: 4,
        savedRaSize: 4,
      },
    },
  ],
};

export const L2_5B: LevelSchema = {
  id: "L2-5b",
  title: "選出 win() 的位址",
  onPass: { advance: "L2-5c" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "位址是編出來就固定的",
      prompt:
        "`win()` 是這支 binary 裡本來就存在、但正常流程永遠不會被呼叫到的一段程式碼（例如印出 flag 再 exit）。它跟其他函式一樣，編譯完就有一個**固定的記憶體位址**——蓋掉 `saved ra` 時，只要把這個位址填進去，函式 `ret` 的時候就會跳過去執行，而不是跳回原本呼叫它的地方。",
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "direct" },
      title: "選出 win() 的位址",
      prompt:
        "從候選清單選出／填入 `win()` 的位址（選單挑，不用手打十六進位）。",
      blanks: [
        {
          id: "winAddr",
          // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
          answer: "0x10074",
          options: ["0x10050", "0x10074", "0x100a0", "0x100c8"],
        },
      ],
    },
  ],
};

export const L2_5C: LevelSchema = {
  id: "L2-5c",
  title: "排出正確的 payload",
  onPass: { advance: "L2-Bonus" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "把三塊拼成一條 payload",
      prompt:
        "L2-5a 找到的 offset（32-byte buffer 填滿＋整個 4-byte `saved s0`，共 36 bytes）、L2-5b 選到的 `win()` 位址，現在要拼成同一條 bytes：\n- 先用 padding 把 32-byte `buffer` **整個填滿**\n- 接著 `saved s0` 那 4 bytes 值不重要（函式不會再用到它），但長度要對，因為它排在 `buffer` 跟 `saved ra` 中間\n- 最後 4 bytes 換成 `win()` 的位址，落在 `saved ra` 的位置\n\n這一步不是拿去打 L2-5a/5b 敘事裡那支「有邊界檢查漏洞的 binary」（那支 binary 目前只存在於敘事，還沒有真的編出來）——而是自己組一支小程式，把這三塊 bytes 依序寫進一塊記憶體，再讀出最後 4 bytes 當成 `ra` 跳過去，藉此驗證「payload 三塊怎麼排」這個技巧本身有沒有抓對。**順序排錯，最後跳的位址就不是 `win()`，程式會跳飛。**",
      // Fully filled through the end of saved ra — the finished payload
      // state this step's drag-order practice is assembling toward.
      stackVisual: {
        bufferSize: 32,
        mode: "offset",
        savedS0Size: 4,
        savedRaSize: 4,
        fillLength: 40,
      },
    },
    {
      widgetType: "drag-order",
      // Same L2-1/L2-2 pattern: each item contributes real asm, concatenated
      // in the player's chosen order and assembled into one self-contained
      // ELF (see DragOrderWidget.tsx) — not a separately-compiled vulnerable
      // binary (that architecture is deliberately deferred, see
      // levels.md 待驗證/待辦). Each item advances a running pointer (t1) by
      // its own chunk size before writing, so the *order* genuinely decides
      // where each chunk's bytes land in `buf` — not just cosmetic label
      // order. The trailing "load ra from buf+36, jalr" only reaches
      // `win-label` (and prints "flag") when win-addr's 4 bytes actually end
      // up at buf+36, i.e. when the 32-byte padding + 4-byte filler
      // together precede it — same 32/4/4 layout and same win() address
      // (0x10074) L2-5a/L2-5b already established, so the three levels'
      // numbers stay consistent.
      judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
      title: "排出正確的 payload",
      prompt:
        "拖曳排出 `[padding × offset]` → `[隨便的 saved s0]` → `[win() 位址]` 的正確順序，排對即成為真正丟進 rv32emu 執行、真的組譯並執行的 payload。",
      items: [
        {
          id: "padding",
          label: "padding × offset（填滿 buffer，32 bytes）",
          // 8 words x 4 bytes = 32 bytes of don't-care filler at the
          // current pointer, then advance the pointer past them.
          asm:
            "    li t0, 0x41414141\n" +
            "    sw t0, 0(t1)\n" +
            "    sw t0, 4(t1)\n" +
            "    sw t0, 8(t1)\n" +
            "    sw t0, 12(t1)\n" +
            "    sw t0, 16(t1)\n" +
            "    sw t0, 20(t1)\n" +
            "    sw t0, 24(t1)\n" +
            "    sw t0, 28(t1)\n" +
            "    addi t1, t1, 32",
        },
        {
          id: "fake-s0",
          label: "隨便的 saved s0（don't-care，4 bytes）",
          asm: "    li t0, 0x42424242\n    sw t0, 0(t1)\n    addi t1, t1, 4",
        },
        {
          id: "win-addr",
          // Canon win() address from L2-5b (0x10074).
          label: "win() 位址",
          asm: "    la t0, win_label\n    sw t0, 0(t1)\n    addi t1, t1, 4",
        },
      ],
      correctOrder: ["padding", "fake-s0", "win-addr"],
      // t1 is the running write pointer each item advances past its own
      // chunk; t2 stays pinned to buf's start so the trailing "read back
      // ra" below always inspects a fixed offset (buf+36) regardless of
      // how t1 ended up moving.
      asmPrefix: "_start:\n    la t1, buf\n    mv t2, t1\n",
      // Read back the last 4 bytes written (buf+36) as if it were the
      // clobbered `ra`, then "return" through it — only lands on
      // win_label when the drag order actually put win-addr's bytes there.
      asmSuffix:
        "\n    lw ra, 36(t2)\n" +
        "    jalr x0, ra, 0\n" +
        "win_label:\n" +
        "    la a1, flag_msg\n" +
        "    li a2, 5\n" +
        "    li a0, 1\n" +
        "    li a7, 64\n" +
        "    ecall\n" +
        "    li a0, 0\n" +
        "    li a7, 93\n" +
        "    ecall\n" +
        ".data\n" +
        'flag_msg: .ascii "flag\\n"\n' +
        "buf: .space 40\n",
    },
  ],
};

export const L2_BONUS: LevelSchema = {
  id: "L2-Bonus",
  title: "拿掉所有輔助，自己組出完整 payload",
  onPass: { advance: "L3-0" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "自己編位址，小端序寫進 bytes",
      prompt:
        "沒有選單了，`win()` 的位址要自己從反組譯結果或符號表找出來。RISC-V 是 **little-endian**，一個 32-bit 位址（例如 `0x10074`）寫進記憶體時，最低位的 byte 放最前面：`74 00 01 00`，不是照著十六進位字面順序排。組語裡可以用 `.word 0x10074` 讓組譯器自動排好位元組順序，不用手動反轉。",
    },
    {
      widgetType: "freehand-editor",
      judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
      title: "拿掉所有輔助，自己組出完整 payload",
      prompt:
        "跟 L2-5 同一支 binary，但拿掉所有輔助：\n- 沒有滑桿（自己找 offset）\n- 沒有位址選單（自己算/找 `win()` 位址）\n- 沒有排序輔助（自己組完整 raw payload bytes）\n\n完賽與否不影響 L2-5 → Boss 的銜接。",
      starterCode: "# raw payload bytes, no scaffold\n",
    },
  ],
};

// ---------------------------------------------------------------------------
// Boss — Canary & ROP
// ---------------------------------------------------------------------------

export const L3_0: LevelSchema = {
  id: "L3-0",
  title: "Canary：編譯器塞的哨兵值",
  onPass: { advance: "L3-1" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "Canary：編譯器塞的哨兵值",
      prompt:
        "**canary** 是編譯器塞在 `buffer` 和 `ra` 之間的哨兵值，被沖走代表越界，程式自殺（`*** stack smashing detected ***`）。",
    },
  ],
};

export const L3_1: LevelSchema = {
  id: "L3-1",
  title: "撞牆：這次先撞到 canary",
  onPass: { advance: "L3-2" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "編譯器怎麼檢查 canary",
      prompt:
        "`-fstack-protector-all` 編出來的函式，在 `ret` 之前會偷偷插入一段檢查：\n- 把 buffer 旁邊存的 `canary` 讀出來\n- 跟一個全域正確值比對\n- 兩者不一樣就代表被溢位覆寫過，直接跳去一個永遠不回來的錯誤處理函式，印出 `*** stack smashing detected ***`\n\n組譯層級大致長這樣：`lw t0, -4(s0)` 讀出堆疊上的 canary，跟正確值比對後 `bne t0, t1, .Lfail`，一致才會真的執行 `ret`；`.Lfail` 裡呼叫的是 `__stack_chk_fail`，不是普通函式返回。",
      // Static layout illustration (unfilled — this step is about the
      // defense mechanism itself, not a specific overflow amount) so the
      // canary's position between buffer and saved s0/ra isn't left purely
      // to the reader's imagination before L3-1's own live slider.
      stackVisual: {
        bufferSize: 32,
        mode: "canary",
        canarySize: 4,
        savedS0Size: 4,
        savedRaSize: 4,
        fillLength: 0,
      },
    },
    {
      widgetType: "lever-slider",
      // No target: judge.kind is 'none', this is pure feel (see types.ts).
      judge: { kind: "none" },
      title: "撞牆：這次先撞到 canary",
      prompt:
        "跟 L2-5a 用同一個滑桿元件，但這次拖曳輸入長度會先撞到新的東西：**canary**。動畫顯示 `buffer` 填滿、吃進 `canary`、觸發偵測當掉——這裡是「滑到撞牆」，同工具、新阻礙。純建立直覺，不用真的 leak。",
      min: 0,
      max: 64,
      // Same buffer/s0/ra shape as L2-5a, plus a 4-byte canary sitting right
      // after the buffer — see levels.md Boss section's ASCII stack diagram.
      stackVisual: {
        bufferSize: 32,
        mode: "canary",
        canarySize: 4,
        savedS0Size: 4,
        savedRaSize: 4,
      },
    },
  ],
};

export const L3_2: LevelSchema = {
  id: "L3-2",
  title: "猜出完整的 canary",
  onPass: { advance: "L3-3" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "一次猜一個 byte，不是一次猜整個 canary",
      prompt:
        "4-byte canary 如果整個一起猜，要試到 2^32（超過 40 億）種組合。但因為每次重跑都是全新的 emulator instance，而且 canary 檢查是逐個 byte 累加比對的，所以可以**只猜第一個 byte**：\n- 猜錯馬上 crash（stack smashing）\n- 猜對則不會 crash，這就洩漏了正確值\n\n確定第一個 byte 後才猜第二個——4 個 byte 分開猜，最多只要試 `4 × 256 = 1024` 次，而不是 `2^32` 次。",
    },
    {
      widgetType: "byte-guesser",
      judge: { kind: "emulator", expect: { exitCode: 0 } },
      title: "猜出完整的 canary",
      prompt:
        "猜錯崩潰、猜對活下來繼續猜下一個 byte（每次重跑都是全新 emulator instance）。手動試 1–2 byte 感受，再一鍵**自動跑完剩下的**。",
      // TODO: placeholder pending real test ELF (see levels.md 待驗證/待辦)
      byteCount: 4,
    },
  ],
};

export const L3_3: LevelSchema = {
  id: "L3-3",
  title: "組出完整 payload：canary 版",
  onPass: { advance: "L3-4" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "canary 插進 buffer 跟 saved ra 中間",
      prompt:
        "跟 L2-5c 排的順序多了一段：\n- `buffer` 填滿\n- 正確 `canary`（L3-2 猜出來的那 4 個 byte，一個都不能錯）\n- 隨便的 `saved s0`\n- 新的 `ra`\n\ncanary 位置錯了、或值不是剛猜出來的那組，函式 `ret` 前的比對就會失敗，直接觸發 stack smashing，永遠到不了新的 `ra`。",
      // Filled up to (not past) the canary boundary only — StackDiagram
      // can't distinguish "the correct canary value, check still passes"
      // from "any write into that region", so filling further would trip
      // its generic canary-detected alert and contradict this step's whole
      // point (a *correct* canary write that does NOT trigger detection).
      // Showing just the buffer fill still illustrates where canary/s0/ra
      // sit relative to it, which is what the prose needs.
      stackVisual: {
        bufferSize: 32,
        mode: "canary",
        canarySize: 4,
        savedS0Size: 4,
        savedRaSize: 4,
        fillLength: 32,
      },
    },
    {
      widgetType: "drag-order",
      judge: { kind: "emulator", expect: { exitCode: 0 } },
      title: "組出完整 payload：canary 版",
      prompt:
        "跟 L2-5c 的組裝技巧一樣，只是這次 payload 多了一段 canary：組出完整 payload：`buffer` 填滿＋正確 `canary`＋隨便的 `s0`＋新的 `ra`。",
      items: [
        { id: "buffer", label: "buffer 填滿" },
        { id: "canary", label: "正確 canary" },
        { id: "fake-s0", label: "隨便的 saved s0" },
        { id: "new-ra", label: "新的 ra（跳轉目標）" },
      ],
      correctOrder: ["buffer", "canary", "fake-s0", "new-ra"],
    },
  ],
};

export const L3_4: LevelSchema = {
  id: "L3-4",
  title: "串出 ORW gadget chain",
  onPass: { advance: "L3-Bonus" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "buffer 太小，塞不下 shellcode，改串 gadget",
      prompt:
        "這次 buffer 小到連一段能開檔讀檔印字的完整 shellcode 都塞不下，而且也沒有 `win()` 這種現成的「一鍵通關」函式可以跳。RISC-V 沒有 x86 那種 pop/push 指令，但 binary 裡到處都是「從堆疊搬值進參數暫存器，再 `ret` 到下一段」的片段，例如 `lw a0, 0(sp); addi sp, sp, 4; ret` ——這種以 `ret` 結尾、可以像積木一樣一段接一段串起來的指令片段叫 **gadget**。把你控制的堆疊資料排成「gadget 位址、gadget 要用的參數、下一個 gadget 位址…」，就能借用 binary 自己的程式碼片段拼出完整 open→read→write 的效果，這就是 **ROP（Return-Oriented Programming）**。",
    },
    {
      widgetType: "gadget-chain",
      judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
      title: "串出 ORW gadget chain",
      prompt:
        "buffer 塞不下完整 shellcode，這次也沒有 `win()` 可以跳——用點選串接的方式，依序選出能組成 open → read → write 效果的 gadget。",
      gadgets: [
        // TODO: placeholder pending real test ELF (see levels.md 待辦: L3-4
        // 的 gadget 清單內容，需從實際編出來的 vulnerable binary 掃出可用
        // gadget) RISC-V 沒有 pop/push——這裡改用真實會出現的
        // load-from-stack 慣用法：lw 從 sp 相對位址搬值進參數暫存器，再
        // addi sp, sp, N 把用掉的空間還回去，最後 ret（jalr x0, ra, 0 的
        // 偽指令）跳下一個 gadget。
        {
          id: "g1",
          address: "0x10120",
          description:
            "lw a0, 0(sp); lw a1, 4(sp); lw a2, 8(sp); addi sp, sp, 12; ret",
        },
        {
          id: "g2",
          address: "0x10148",
          description: "lw a7, 0(sp); addi sp, sp, 4; ret",
        },
        { id: "g3", address: "0x10160", description: "ecall; ret" },
        { id: "g4", address: "0x10188", description: "mv a0, sp; ret" },
      ],
      correctChain: ["g1", "g2", "g3"],
    },
  ],
};

export const L3_BONUS: LevelSchema = {
  id: "L3-Bonus",
  title: "終盤大魔王：自己反組譯、自己串 ROP",
  onPass: { advance: null },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "終盤大魔王：沒有清單，自己反組譯",
      prompt:
        "L3-4 幫你篩好了候選 gadget 清單；這關拿掉了——要自己把 binary 反組譯，掃過整段程式碼找出以 `ret`（`jalr x0, ra, 0`）結尾、對你有用的指令片段，記下每個片段的位址，再手動排出完整的堆疊資料：一串 `[gadget 位址, 參數, 下一個 gadget 位址, ...]` 交錯排列，用 `.word` 指示詞把每個 32-bit 值依序寫進 payload，讓劫持後的 `ra` 一路跳過整條 ORW chain。完賽與否不影響 L3-4 已經拿到的完賽感，這關純粹是給想要「破台」證明的人。",
    },
    {
      widgetType: "freehand-editor",
      judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
      title: "終盤大魔王：自己反組譯、自己串 ROP",
      prompt:
        "跟 L3-4 同一支 binary，但拿掉 gadget 清單輔助：自己反組譯找 gadget、自己算位址、自己串出完整 raw payload。這才是真正的**「終盤大魔王／破台」**成就，完賽與否不影響 L3-4 已經拿到的完賽感。",
      starterCode: "# find your own gadgets, no candidate list\n",
    },
  ],
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

// Canonical branch display order + section headings — shared between
// MapPage.tsx (branch section headings) and ProfilePage.tsx (current entry
// branch label), so the two don't drift out of sync with independent copies.
export type BranchKey = keyof typeof branchLevelIds;

export const BRANCH_ORDER: BranchKey[] = ["L0", "L1", "L2", "Boss"];

export const BRANCH_TITLES: Record<BranchKey, string> = {
  L0: "Level 0 · 暖身",
  L1: "Level 1 · Calling Convention",
  L2: "Level 2 · Shellcode",
  Boss: "Boss · Canary & ROP",
};

// First level id for each entry point (mirrors EntryPage.tsx's option list)
// — used by MapPage to figure out where in the overall `levels` chain a
// session's progress should be measured from, so an L2 entrant's map never
// gets misread as "stuck at L0-1" just because L0/L1 levels were never
// entered.
export const entryFirstLevelId: Record<string, string> = {
  L0: "L0-1",
  L1: "L1-1",
  L2: "L2-0",
};
