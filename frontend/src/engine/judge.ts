import type { EmulatorResult, JudgeResult, LevelStep } from "./types";
import { directJudges } from "./widgetRegistry";

// judge.kind 'emulator' grading is generic — not per-widget — so it stays
// here rather than living in any one widget's defineWidget() bundle (see
// widgetDefinition.ts's file header).
function judgeEmulatorResult(step: LevelStep, result: EmulatorResult): boolean {
  if (step.judge.kind !== "emulator") return false;
  const { expect } = step.judge;
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
  if (expect.registers !== undefined) {
    for (const [reg, expected] of Object.entries(expect.registers)) {
      if (result.registers[reg] !== expected) return false;
    }
  }
  return true;
}

export function judgeStep(
  step: LevelStep,
  input: EmulatorResult | unknown,
): JudgeResult {
  switch (step.judge.kind) {
    case "none":
      return { pass: true };
    case "emulator":
      return { pass: judgeEmulatorResult(step, input as EmulatorResult) };
    case "direct": {
      const directJudge = directJudges[step.widgetType];
      if (!directJudge) {
        throw new Error(
          `no direct-judge comparator registered for widget type "${step.widgetType}"`,
        );
      }
      return { pass: directJudge(step, input) };
    }
  }
}
