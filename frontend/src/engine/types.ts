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
}

export interface FillBlankStep extends StepBase {
  widgetType: "fill-blank";
  blanks: Array<{ id: string; answer: string; options: string[] }>;
  // Opt-in: which registers to show in a RegisterBank visualization above
  // the blanks (e.g. ["a0"..."a7"] for calling-convention levels L1-2/L1-3).
  // Absent for non-register fill-blanks (e.g. L0-1's arithmetic questions).
  registerContext?: string[];
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
  entryPoint: "L0" | "L1" | "L2";
  events: Array<{
    levelId: string;
    enteredAt: number;
    passedAt?: number;
    attempts: number;
  }>;
  rewards: Array<{ kind: RewardKind; grantedAt: number; levelId: string }>;
}
