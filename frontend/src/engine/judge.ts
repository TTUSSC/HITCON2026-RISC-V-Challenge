import type {
  DragOrderLevel,
  EmulatorResult,
  FillBlankLevel,
  GadgetChainLevel,
  JudgeResult,
  LeverSliderLevel,
  LevelSchema,
} from "./types";

// Direct-judge comparators — one per widget type that can grade itself from
// user input alone, without running the emulator. Widgets not listed here
// (drag-fill, freehand-editor, byte-guesser) only ever appear with
// judge.kind === 'emulator' per the design in
// docs/design/platform-architecture.md.
const directComparators = {
  "fill-blank": (schema: FillBlankLevel, input: unknown): boolean => {
    const answers = input as Record<string, string> | undefined;
    if (!answers) return false;
    return schema.blanks.every((blank) => answers[blank.id] === blank.answer);
  },
  "lever-slider": (schema: LeverSliderLevel, input: unknown): boolean => {
    if (schema.target === undefined) return false; // e.g. L3-1 has no target
    return input === schema.target;
  },
  "gadget-chain": (schema: GadgetChainLevel, input: unknown): boolean => {
    const chain = input as string[] | undefined;
    if (!chain) return false;
    return (
      chain.length === schema.correctChain.length &&
      chain.every((id, i) => id === schema.correctChain[i])
    );
  },
  "drag-order": (schema: DragOrderLevel, input: unknown): boolean => {
    const order = input as string[] | undefined;
    if (!order) return false;
    return (
      order.length === schema.correctOrder.length &&
      order.every((id, i) => id === schema.correctOrder[i])
    );
  },
} satisfies Partial<Record<string, (schema: never, input: unknown) => boolean>>;

function judgeEmulatorResult(
  schema: LevelSchema,
  result: EmulatorResult,
): boolean {
  if (schema.judge.kind !== "emulator") return false;
  const { expect } = schema.judge;
  if (expect.exitCode !== undefined && result.exitCode !== expect.exitCode) {
    return false;
  }
  if (expect.stdout !== undefined && result.stdout !== expect.stdout) {
    return false;
  }
  if (
    expect.stdoutContains !== undefined &&
    !result.stdout.includes(expect.stdoutContains)
  ) {
    return false;
  }
  return true;
}

export function judge(
  schema: LevelSchema,
  input: EmulatorResult | unknown,
): JudgeResult {
  switch (schema.judge.kind) {
    case "none":
      return { pass: true };
    case "emulator":
      return { pass: judgeEmulatorResult(schema, input as EmulatorResult) };
    case "direct": {
      const comparator = directComparators[
        schema.type as keyof typeof directComparators
      ] as ((schema: LevelSchema, input: unknown) => boolean) | undefined;
      if (!comparator) {
        throw new Error(
          `no direct-judge comparator registered for widget type "${schema.type}"`,
        );
      }
      return { pass: comparator(schema, input) };
    }
  }
}
