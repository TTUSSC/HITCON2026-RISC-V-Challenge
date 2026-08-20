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
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "暫存器就是超快的變數",
      prompt:
        "RISC-V 用 `add`／`addi`／`sub` 做加減。`addi a0, x0, 5` 的意思是「把 `a0` 設成 `x0` 加 5」——`x0` 永遠是 0，所以其實就是把 `a0` 設成 5。\n\n指令格式固定是**「動作 目的地, 來源, 立即值」**，接下來換你選出正確的立即值。",
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 5 } } },
      title: "把 a0 設成 5",
      prompt: "從少數選項中選填空湊出目標值：把 `a0` 設成 **5**。",
      asmLines: ["addi a0, x0, {{imm}}"],
      blanks: [{ id: "imm", answer: "5", options: ["3", "5", "7", "10"] }],
      checkRegister: "a0",
    },
  ],
};

export const L0_2: LevelSchema = {
  id: "L0-2",
  title: "li／mv 其實是假指令",
  onPass: { advance: "L0-3" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "li／mv／nop／ret 都是假指令",
      prompt:
        "CPU 實際上沒有 `li`／`mv` 這兩個指令——組譯器會偷偷把它們展開成真正的指令：\n- `li a0, 5` 展開成 `addi a0, x0, 5`（跟 `x0` 加 5）\n- `mv a0, a1` 展開成 `addi a0, a1, 0`（跟 `a1` 加 0）\n\n這種「寫起來像指令、實際是別的指令的縮寫」叫**假指令（pseudo-instruction）**，`nop`（什麼都不做）跟 `ret`（跳回呼叫者）也是同一種把戲，之後會遇到。",
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 7 } } },
      title: "用 mv 複製暫存器",
      prompt:
        "`a1` 已經被設成 **7**，用 `mv` 把 `a1` 的值複製到 `a0`（等於是 `addi a0, a1, 0` 的簡寫）：",
      asmLines: ["mv a0, {{src}}"],
      // a1 is pre-loaded with a known value (7) so only the correct base
      // (a1) reproduces it in a0 — the other options land on a1/a2/ra's
      // actual reset state (0), which fails the register check just as
      // wrong answers should.
      setupAsmTemplate: "li a1, 7\nmv a0, {{src}}",
      checkRegister: "a0",
      blanks: [
        { id: "src", answer: "a1", options: ["a1", "a2", "zero", "ra"] },
      ],
    },
  ],
};

export const L0_3: LevelSchema = {
  id: "L0-3",
  title: "暫存器帶不下所有東西，要跟記憶體借",
  onPass: { advance: "L0-4" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "跟記憶體借一格",
      prompt:
        "暫存器只有 32 個，帶不下所有東西，要跟記憶體借。**`lw`（load word）跟 `sw`（store word）** 是讀寫記憶體的一對指令，語法都是 `offset(base)`：\n- `lw a0, 0(a1)` ——從 `a1` 這個位址往後 0 個 byte，讀 4 個 byte 進 `a0`\n- `sw a0, 0(a1)` ——把 `a0` 的值寫到 `a1` 指到的位址\n\noffset 可以不是 0，例如 `lw a0, 4(a1)` 是往後跳 4 個 byte 再讀。",
    },
    {
      widgetType: "fill-blank",
      judge: { kind: "emulator", expect: { registers: { a0: 42 } } },
      title: "選出正確的 base 暫存器",
      prompt: "位址在 `a1`，從選項中選出補完讀值到 `a0` 的指令：",
      asmLines: ["lw a0, 0({{base}})"],
      // Each candidate base register points at a distinct known word — only
      // a1 points at the word holding 42, so wrong choices load a different
      // (wrong) value instead of crashing on an invalid address.
      setupAsmTemplate:
        "la a1, __l03_correct\n" +
        "la a0, __l03_wrong_a\n" +
        "la a2, __l03_wrong_b\n" +
        "la sp, __l03_wrong_c\n" +
        "lw a0, 0({{base}})",
      probeExtraData:
        "__l03_correct: .word 42\n" +
        "__l03_wrong_a: .word 17\n" +
        "__l03_wrong_b: .word 34\n" +
        "__l03_wrong_c: .word 51",
      checkRegister: "a0",
      blanks: [{ id: "base", answer: "a1", options: ["a0", "a1", "a2", "sp"] }],
    },
  ],
};

export const L0_4: LevelSchema = {
  id: "L0-4",
  title: "分支：比較跟跳轉是同一個指令做完的",
  onPass: { advance: "L1-1" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "分支：比較跟跳轉是同一個指令做完的",
      prompt:
        "`beq`／`bne`／`blt`／`bge`——RISC-V 沒有 flags register，**比較跟跳轉是同一個指令做完的**。這條技能樹後面用不到 branch（後面都是純線性 syscall 呼叫，或比較邏輯已經編譯進 vulnerable binary），先眼熟就好，不用操作。",
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 1 — Calling Convention
// ---------------------------------------------------------------------------

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
        "這 8 個暫存器（`x10`–`x17`，也就是 `a0`–`a7`）是函式參數／回傳值。先不談 `ra`／`sp`，只建立這一件事：**這 8 個是你跟外界溝通的管道**。",
      registerContext: ["a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7"],
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
      judge: { kind: "direct" },
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
      judge: { kind: "direct" },
      title: "write 要知道寫到哪裡",
      prompt:
        "把 `a0` 設成 **1**（stdout）。L1-2 ＋ L1-3 合起來等於原本一次到位的目標——過關瞬間已經站在 Level 2 門口。",
      asmLines: ["li a0, {{a0}}   # 1 = stdout", "li a7, 64", "ecall"],
      blanks: [{ id: "a0", answer: "1", options: ["0", "1", "2", "64"] }],
      registerContext: ["a0", "a1", "a7"],
    },
  ],
};

export const L1_4: LevelSchema = {
  id: "L1-4",
  title: "ra 與 sp：先混個眼熟",
  onPass: { advance: "L2-0" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "ra 與 sp：先混個眼熟",
      prompt:
        "- `ra`（`x1`）：函式怎麼記得要跳回哪\n- `sp`（`x2`）：堆疊指標\n\n不考，純粹先混眼熟——Boss 分支的整個 stack 佈局會直接用到這兩個。",
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
      widgetType: "drag-fill",
      judge: { kind: "emulator", expect: { stdout: "HI" } },
      title: "拖曳字串位址／長度",
      prompt:
        "拖曳字串位址／長度進 `a1`／`a2`，組出一段能印出 **HI** 的 shellcode。",
      slots: [
        {
          id: "a1",
          label: "字串位址",
          options: ["0x10000", "0x20000", "0x30000"],
          answer: "0x10000",
          // "0x10000" reads as "the string's real address" (msg happens to
          // sit right at this program's base address) — the wrong options
          // point at unmapped memory, so a wrong pick crashes instead of
          // printing.
          optionAsm: {
            "0x10000": "la a1, msg",
            "0x20000": "li a1, 0x20000",
            "0x30000": "li a1, 0x30000",
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
  title: "從零刻出完整 ORW",
  onPass: { advance: "L2-5a" },
  steps: [
    {
      widgetType: "observation",
      judge: { kind: "none" },
      title: "從零手刻：沒有骨架了",
      prompt:
        '前面幾關 `li a7, ___` / `ecall` 的骨架都被拿掉了，這次要自己寫出完整結構：\n- 一個 `.data` 段放檔名字串（例如 `path: .asciz "flag.txt"`）\n- 一個 `_start` 標籤開始執行\n- 依序 `open` → `read` → `write` → `exit`，各自 `li a7, N` / `ecall`\n\n`open` 拿到的 `fd` 存在 `a0`，記得先搬到別的暫存器（例如 `mv s1, a0`）再繼續用，否則下一個 syscall 會把 `a0` 蓋掉。',
    },
    {
      widgetType: "freehand-editor",
      judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
      title: "從零刻出完整 ORW",
      prompt:
        '`open("flag.txt")` → `read` → `write`，全部自己手寫，拿掉所有 scaffold。已經熟 RISC-V 的人可以直接跳來這裡秀操作。',
      starterCode: "# open -> read -> write, from scratch\n.text\n_start:\n",
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
        "L2-5a 找到的 offset、L2-5b 選到的 `win()` 位址，現在要拼成同一條 bytes：\n- 先用 padding 把 buffer 填滿到剛好蓋到 `saved ra` 前一格\n- 中間 `saved s0` 那 4 bytes 值不重要（函式不會再用到它）\n- 最後 4 bytes 換成 `win()` 的位址\n\n寫超過 `saved ra` 邊界的部分，會蓋到更遠的記憶體，反而讓程式在跳轉前就崩潰，所以**順序跟長度都要抓準**。",
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
      judge: { kind: "emulator", expect: { stdoutContains: "flag" } },
      title: "排出正確的 payload",
      prompt:
        "拖曳排出 `[padding × offset]` → `[隨便的 saved s0]` → `[win() 位址]` 的正確順序，排對即成為真正丟進 rv32emu 執行的 payload。",
      items: [
        { id: "padding", label: "padding × offset（填滿 buffer）" },
        { id: "fake-s0", label: "隨便的 saved s0" },
        { id: "win-addr", label: "win() 位址" },
      ],
      correctOrder: ["padding", "fake-s0", "win-addr"],
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
