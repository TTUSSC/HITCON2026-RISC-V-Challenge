// Level schema + engine types. Mirrors docs/design/platform-architecture.md.
//
// Widget (how it's drawn) and JudgeSpec (how it's graded) are deliberately
// orthogonal — see platform-architecture.md's "Widget Catalog" section for
// why (L2-1 used to conflate the two and drifted out of sync with the
// content design).
//
// Phase 3 shape: a level ("Ln-m", still the path-map node id) is a short
// *sequence* of steps — the Duolingo "lesson" granularity the repo owner
// asked for (docs/design/levels.md's 前提與限制 + explicit complaint: one
// level used to be one full-screen widget with the whole branch's progress
// bar spanning it). Only the LAST step's pass fires onPass (session-store
// recordPass/grantReward/advance) — see engine/LevelPlayer.tsx. A step whose
// judge.kind is 'none' (observation, or a feel-only widget like L3-1's
// lever-slider) just advances to the next step with no correctness check.

export type WidgetType =
  | "observation"
  | "fill-blank"
  | "drag-order"
  | "drag-fill"
  | "lever-slider"
  | "byte-guesser"
  | "gadget-chain"
  | "freehand-editor";

export type RewardKind = "hitcon-badge" | "ttussc-merch";

export interface EmulatorResult {
  exitCode: number;
  stdout: string;
  registers: Record<string, number>;
  memory?: Record<number, Uint8Array>;
}

export interface EmulatorExpectation {
  stdout?: string;
  stdoutContains?: string;
  exitCode?: number;
  // Expected final register values. Checked against EmulatorResult.registers
  // — see emulatorAdapter.ts's run() for how that gets populated (the real
  // WASM build exports no register-accessor, so it's parsed off a "reg=
  // value" stdout line a register-probe test harness prints; see
  // assembler/registerProbe.ts for the full rationale). Used by L0-1..L0-3.
  registers?: Record<string, number>;
}

export type JudgeSpec =
  | { kind: "none" }
  | { kind: "direct" }
  | { kind: "emulator"; expect: EmulatorExpectation };

// ---------------------------------------------------------------------------
// Reusable execution-state visuals — the L0 cognitive-load review's #1
// finding (docs/design/cogload-review-L0.md): every graded L0 practice step
// already runs real assembled code through the real WASM emulator with real
// register/memory results, but that state was never shown to the learner.
// These three shapes cover the three things the review asked to make
// visible: register before/after (RegisterBank, extended below), addressed
// memory (MemoryCells), and a code-trace for branch/jump flow (CodeTrace).
// Declarative + optional on ObservationStep/FillBlankStep, same pattern as
// LeverSliderStep.stackVisual.
// ---------------------------------------------------------------------------

// One addressed-memory cell (typically one word) for MemoryCells — see
// components/MemoryCells.tsx. `offset` is the byte offset from
// `MemoryVisualSpec.baseRegister`'s address, `value` is the free-form
// display string (e.g. "42", "—").
export interface MemoryCellSpec {
  offset: number;
  value?: string;
  label?: string;
}

// General (non-stack) addressed-memory visual for L0-3's lw/sw content —
// StackDiagram's buffer/canary/saved-s0/saved-ra layout is not a fit for
// this (see cogload-review-L0.md L0-3 §4). Renders a base-address register
// box plus a row of byte/word cells, with the base+offset target cell
// highlighted and a load/store direction indicator toward `targetRegister`.
export interface MemoryVisualSpec {
  baseRegister: string;
  baseValue?: string;
  cells: MemoryCellSpec[];
  bytesPerCell?: number; // default 4 (one word)
  highlightOffset?: number;
  direction?: "load" | "store";
  targetRegister?: string;
}

// One row in a CodeTrace — see components/CodeTrace.tsx. `label` is an
// optional destination label prefix (e.g. "target:") rendered before the
// instruction text.
export interface CodeTraceLine {
  id: string;
  text: string;
  label?: string;
}

// Branch/jump code-trace visual for L0-4's flow content (and L0-2's jal/jalr
// exposition screen) — plain assembly-line rendering with a current-line
// highlight, a fall-through/taken-path annotation, and (once a practice
// step's emulator run has resolved) which path actually executed.
export interface CodeTraceSpec {
  lines: CodeTraceLine[];
  currentLineId?: string;
  fallthroughLineId?: string;
  takenLineId?: string;
  executedPath?: "taken" | "fallthrough";
}

// ---------------------------------------------------------------------------
// Steps — one screen inside a level's sequence. Every step carries its own
// title/prompt (a multi-step level's steps each say something different) and
// judge (gates advancement iff judge.kind !== 'none'). widgetType picks the
// widget component the same way the old per-level `type` field used to.
// ---------------------------------------------------------------------------

interface StepBase {
  title: string;
  prompt: string;
  judge: JudgeSpec;
}

export interface ObservationStep extends StepBase {
  widgetType: "observation";
  judge: { kind: "none" };
  // Optional reference RegisterBank shown under the prompt — e.g. L1-2's
  // observation step recapping what a7/a0-a2 mean before the fill-blank
  // practice step. `values` are free-form labels (not real register state),
  // e.g. { a7: "syscall 編號" } — see components/RegisterBank.tsx.
  registerContext?: string[];
  registerLabels?: Partial<Record<string, string>>;
  // Paired with registerLabels (read as the "before" values) to render a
  // before -> after transition per register box (e.g. L0-1's worked
  // `addi a0, x0, 3` step: a0 "— -> 3") — see the execution-state-visual
  // note above and components/RegisterBank.tsx's `after` prop. Omitted for
  // plain static-value observation steps (e.g. L1-1's a0-a7 role recap).
  registerAfter?: Partial<Record<string, string>>;
  // Optional general addressed-memory visual (L0-3's lw/sw content) — see
  // MemoryVisualSpec above.
  memoryVisual?: MemoryVisualSpec;
  // Optional branch/jump code-trace visual (L0-4's flow content, L0-2's
  // jal/jalr exposition) — see CodeTraceSpec above.
  codeTrace?: CodeTraceSpec;
  // Optional reference StackDiagram shown under the prompt — e.g. the
  // stack-layout explainer steps preceding L2-5a/L2-5c/L3-1/L3-3's
  // lever-slider/drag-order practice steps, so the prose describing
  // buffer/canary/saved-s0/saved-ra order has an accompanying visual
  // instead of asking the player to hold the layout in their head until the
  // next step's interactive diagram. Same shape as LeverSliderStep's
  // stackVisual (see components/StackDiagram.tsx) plus a fixed `fillLength`
  // since there's no slider here to drive it live — pick whatever fill
  // amount best illustrates the point this particular step is making (e.g.
  // 0 for "here's the layout" vs. a full overwrite for "here's the finished
  // payload").
  stackVisual?: {
    bufferSize: number;
    mode: "offset" | "canary";
    canarySize?: number;
    savedS0Size: number;
    savedRaSize: number;
    fillLength: number;
  };
}

export interface FillBlankStep extends StepBase {
  widgetType: "fill-blank";
  blanks: Array<{ id: string; answer: string; options: string[] }>;
  // Opt-in: which registers to show in a RegisterBank visualization above
  // the blanks (e.g. ["a0"..."a7"] for calling-convention levels L1-2/L1-3).
  // Absent for non-register fill-blanks (e.g. L0-1's arithmetic questions).
  registerContext?: string[];
  // Known initial register state shown before any option is picked (e.g.
  // L0-2's `mv` step: a1 = 7, set by a hidden setupAsmTemplate line the
  // learner never otherwise sees) — see cogload-review-L0.md L0-2 §4 "Add
  // initial register values to FillBlankStep". FillBlankWidget merges this
  // under the dynamic post-selection/post-run values it already computes.
  registerBefore?: Partial<Record<string, string>>;
  // Optional general addressed-memory visual (L0-3's lw/sw practice) — see
  // MemoryVisualSpec.
  memoryVisual?: MemoryVisualSpec;
  // Optional branch/jump code-trace visual (L0-4's beq/bne practice) — see
  // CodeTraceSpec. `executedPath` is meaningful once the step's emulator run
  // has resolved; FillBlankWidget fills it in from the schema's declared
  // correct path once judge.kind 'emulator' passes (the schema already
  // encodes which path a correct answer takes, so no raw-result inference is
  // needed here — see FillBlankWidget.tsx).
  codeTrace?: CodeTraceSpec;
  // Real RISC-V instruction line(s) shown as the primary visual element
  // (monospace), with each blank rendered inline via a "{{blankId}}"
  // placeholder substituted by the picked option once chosen — e.g.
  // ["addi a0, x0, {{imm}}"]. Added so fill-blank levels read as an actual
  // asm crash course instead of prose describing register concepts in the
  // abstract (see FillBlankWidget.tsx). Optional so existing non-asm
  // fill-blanks (none currently, but keeps the schema honest) aren't forced
  // to fabricate a code line.
  asmLines?: string[];
  // judge.kind 'emulator' only (L0-1..L0-3): the actual program body run to
  // test the picked option(s), with the same "{{blankId}}" placeholder
  // substitution as asmLines. May differ from asmLines (e.g. extra setup
  // instructions the player doesn't need to see, like pre-loading a1 with a
  // known value before L0-2's `mv a0, {{src}}`) — falls back to
  // asmLines.join("\n") when omitted. Assembled via
  // assembler/registerProbe.ts's buildRegisterProbeProgram, which appends
  // code to report `checkRegister`'s final value.
  setupAsmTemplate?: string;
  checkRegister?: string;
  // Extra data-only asm (labels + .word/.byte/.asciz/.space, no
  // instructions) that setupAsmTemplate addresses via la/lw/sw — e.g. L0-3
  // needs known memory contents for `lw` to read from. See
  // assembler/registerProbe.ts's `extraData` parameter for why this can't
  // just be appended inline to setupAsmTemplate.
  probeExtraData?: string;
}

export interface DragOrderStep extends StepBase {
  widgetType: "drag-order";
  items: Array<{
    id: string;
    label: string;
    // Real assembly text this item contributes when judge.kind is
    // 'emulator' — concatenated in the player's chosen order and assembled
    // (see LevelPlayer.tsx). Optional because not every drag-order step is
    // emulator-judged (some direct-judge steps only care about order).
    asm?: string;
  }>;
  correctOrder: string[];
  // Assembled ahead of the (concatenated, in-order) item asm, and after it,
  // respectively — e.g. a `_start:` label + register setup before, an exit
  // syscall after. Only meaningful when judge.kind is 'emulator'.
  asmPrefix?: string;
  asmSuffix?: string;
  // Static files to preload into the emulator's virtual FS before running
  // the assembled payload (see emulatorAdapter.ts's RunRequest.files) —
  // needed when the assembled asm does a real open()/read() against a path
  // that must actually exist, e.g. L2-2's open("flag.txt"). `contents` is
  // plain text, UTF-8-encoded by the widget at submit time. Only meaningful
  // when judge.kind is 'emulator'.
  files?: Array<{ path: string; contents: string }>;
}

export interface DragFillStep extends StepBase {
  widgetType: "drag-fill";
  slots: Array<{
    id: string;
    label: string;
    options: string[];
    answer: string;
    // Assembly text each option contributes when placed in this slot, keyed
    // by the option's display string (same strings as `options`) — e.g.
    // L2-1's "a1" slot maps "0x10000" -> "la a1, msg". Only meaningful when
    // judge.kind is 'emulator'.
    optionAsm?: Record<string, string>;
  }>;
  // Assembled around the slots' chosen-option asm, in slot order — e.g. a
  // `_start:` label + syscall number setup before, an exit syscall after.
  asmPrefix?: string;
  asmSuffix?: string;
  // Optional general addressed-memory visual (cogload-review-L2.md finding
  // #2: L2-1's practice step asked for a memory address with no memory map
  // ever shown) — see MemoryVisualSpec above. Same optional field already on
  // ObservationStep/FillBlankStep.
  memoryVisual?: MemoryVisualSpec;
}

export interface LeverSliderStep extends StepBase {
  widgetType: "lever-slider";
  min: number;
  max: number;
  target?: number; // absent when judge.kind === 'none' (pure feel, e.g. L3-1)
  // Optional stack-diagram parameters (StackDiagram component) driven live
  // by the slider value. Absent -> LeverSliderWidget degrades to a plain
  // slider (e.g. for a future non-stack-overflow lever-slider level).
  stackVisual?: {
    bufferSize: number;
    mode: "offset" | "canary"; // 'offset' = L2-5a (no canary), 'canary' = L3-1
    canarySize?: number; // only relevant when mode === 'canary'
    savedS0Size: number;
    savedRaSize: number;
  };
}

export interface ByteGuesserStep extends StepBase {
  widgetType: "byte-guesser";
  byteCount: number;
}

export interface GadgetChainStep extends StepBase {
  widgetType: "gadget-chain";
  gadgets: Array<{ id: string; address: string; description: string }>;
  correctChain: string[];
}

export interface FreehandEditorStep extends StepBase {
  widgetType: "freehand-editor";
  starterCode?: string;
  // Static files to preload into the emulator's virtual FS before running
  // the assembled payload (see emulatorAdapter.ts's RunRequest.files) —
  // needed when the assembled asm does a real open()/read() against a path
  // that must actually exist, e.g. L2-4's open("flag.txt"). `contents` is
  // plain text, UTF-8-encoded by the widget at submit time. Mirrors
  // DragOrderStep.files above.
  files?: Array<{ path: string; contents: string }>;
}

export type LevelStep =
  | ObservationStep
  | FillBlankStep
  | DragOrderStep
  | DragFillStep
  | LeverSliderStep
  | ByteGuesserStep
  | GadgetChainStep
  | FreehandEditorStep;

// ---------------------------------------------------------------------------
// Level — a path-map node ("Ln-m"). onPass fires once, after the LAST step's
// judge passes (see LevelPlayer.tsx) — not per-step.
// ---------------------------------------------------------------------------

export interface LevelSchema {
  id: string;
  title: string;
  onPass: { advance: string | null; reward?: RewardKind };
  steps: LevelStep[];
}

// What a widget hands back to judgeStep() — shape depends on the widget,
// judgeStep() narrows on step.widgetType to know what to expect.
export type WidgetInput = unknown;

export interface JudgeResult {
  pass: boolean;
}

export interface SessionProgress {
  sessionId: string;
  // Stable per-browser id, independent of sessionId's daily reset — see
  // engine/profileId.ts for why. Lets a future backend submission uniquely
  // identify "this profile" across days without any account system.
  profileId: string;
  // Local-only nickname set on EntryPage during the initial 三選一 pick (or
  // edited later from ProfilePage) — no account, just a display label so the
  // booth's "個人頁" isn't just anonymous stats. Empty string means "not set
  // yet"; callers fall back to a generic label rather than treating it as
  // required.
  displayName: string;
  // True once EntryPage's nickname modal has been confirmed at least once —
  // gates re-entry to "/" (see App.tsx's route guard) so re-visiting the
  // entry pick can't silently overwrite an already-created profile.
  onboarded: boolean;
  entryPoint: "L0" | "L1" | "L2";
  events: Array<{
    levelId: string;
    enteredAt: number;
    passedAt?: number;
    attempts: number;
  }>;
  rewards: Array<{ kind: RewardKind; grantedAt: number; levelId: string }>;
}
