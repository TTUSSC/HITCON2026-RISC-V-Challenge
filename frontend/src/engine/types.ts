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
}

export interface DragOrderLevel extends LevelBase {
  type: "drag-order";
  items: Array<{ id: string; label: string }>;
  correctOrder: string[];
}

export interface DragFillLevel extends LevelBase {
  type: "drag-fill";
  slots: Array<{
    id: string;
    label: string;
    options: string[];
    answer: string;
  }>;
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
