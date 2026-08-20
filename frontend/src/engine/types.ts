// Level schema + engine types. Mirrors docs/design/platform-architecture.md.
//
// Widget (how it's drawn) and JudgeSpec (how it's graded) are deliberately
// orthogonal — see platform-architecture.md's "Widget Catalog" section for
// why (L2-1 used to conflate the two and drifted out of sync with the
// content design).

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

interface LevelBase {
  id: string;
  title: string;
  prompt: string;
  judge: JudgeSpec;
  onPass: { advance: string | null; reward?: RewardKind };
}

export interface ObservationLevel extends LevelBase {
  type: "observation";
  judge: { kind: "none" };
}

export interface FillBlankLevel extends LevelBase {
  type: "fill-blank";
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

export interface DragOrderLevel extends LevelBase {
  type: "drag-order";
  items: Array<{
    id: string;
    label: string;
    // Real assembly text this item contributes when judge.kind is
    // 'emulator' — concatenated in the player's chosen order and assembled
    // (see LevelPlayer.tsx). Optional because not every drag-order level is
    // emulator-judged (some direct-judge levels only care about order).
    asm?: string;
  }>;
  correctOrder: string[];
  // Assembled ahead of the (concatenated, in-order) item asm, and after it,
  // respectively — e.g. a `_start:` label + register setup before, an exit
  // syscall after. Only meaningful when judge.kind is 'emulator'.
  asmPrefix?: string;
  asmSuffix?: string;
}

export interface DragFillLevel extends LevelBase {
  type: "drag-fill";
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

export interface LeverSliderLevel extends LevelBase {
  type: "lever-slider";
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

export interface ByteGuesserLevel extends LevelBase {
  type: "byte-guesser";
  byteCount: number;
}

export interface GadgetChainLevel extends LevelBase {
  type: "gadget-chain";
  gadgets: Array<{ id: string; address: string; description: string }>;
  correctChain: string[];
}

export interface FreehandEditorLevel extends LevelBase {
  type: "freehand-editor";
  starterCode?: string;
}

export type LevelSchema =
  | ObservationLevel
  | FillBlankLevel
  | DragOrderLevel
  | DragFillLevel
  | LeverSliderLevel
  | ByteGuesserLevel
  | GadgetChainLevel
  | FreehandEditorLevel;

// What a widget hands back to judge() — shape depends on the widget, judge()
// narrows on schema.type to know what to expect.
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
