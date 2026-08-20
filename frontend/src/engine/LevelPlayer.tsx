// Looks up the right widget for the current step of a LevelSchema, renders
// it, and owns the judge/session-store wiring the widget itself must never
// do (see widgetRegistry.tsx / platform-architecture.md design principle
// #2). A level ("Ln-m") is a short sequence of steps (Phase 3 — see
// types.ts's file header); LevelPlayer owns which step is currently visible
// and only runs the session-store recordPass/grantReward/onAdvance flow
// once, after the LAST step's judge passes. A step whose judge.kind is
// 'none' (observation, or a feel-only widget like L3-1's lever-slider) just
// advances to the next step with no correctness check.
//
// Flow per step: widget calls onPass(rawInput) -> LevelPlayer runs
// emulatorAdapter.run() first if the step's judge.kind === 'emulator'
// (rawInput is then the RunRequest the step needs executed), then always
// calls judgeStep(step, ...) -> on pass, either advances stepIndex (not the
// last step) or records progress in the session store and reports the next
// level id via onAdvance (last step). Routing itself (react-router-dom) is
// out of scope here.

import { useEffect, useState } from "react";
import type { LevelSchema, LevelStep } from "./types";
import type { RunRequest } from "./emulatorAdapter";
import { run as runEmulator } from "./emulatorAdapter";
import { judgeStep } from "./judge";
import { useSessionStore } from "./sessionStore";
import { widgetRegistry } from "./widgetRegistry";
import type { WidgetComponent } from "./widgetDefinition";

export interface LevelPlayerProps {
  schema: LevelSchema;
  onAdvance: (nextLevelId: string | null) => void;
  // Reported whenever the visible step changes (including once on mount/
  // level-change) so LevelPage can drive its progress bar off position
  // within *this level's* steps instead of position within the whole
  // branch — see LevelPage.tsx's progressPercent.
  onStepChange?: (stepIndex: number, totalSteps: number) => void;
}

export function LevelPlayer({
  schema,
  onAdvance,
  onStepChange,
}: LevelPlayerProps) {
  const enterLevel = useSessionStore((s) => s.enterLevel);
  const recordPass = useSessionStore((s) => s.recordPass);
  const grantReward = useSessionStore((s) => s.grantReward);
  const [stepIndex, setStepIndex] = useState(0);

  // Reset stepIndex the moment `schema` changes to a different level, using
  // the React-recommended "adjust state during render" pattern instead of
  // an effect — an effect that calls setState synchronously on every render
  // it fires is flagged by react-hooks/set-state-in-effect (cascading
  // re-render), and there's no external system to synchronize with here,
  // just local state that needs to track a prop change.
  const [trackedLevelId, setTrackedLevelId] = useState(schema.id);
  if (trackedLevelId !== schema.id) {
    setTrackedLevelId(schema.id);
    setStepIndex(0);
  }

  useEffect(() => {
    enterLevel(schema.id);
    // Only re-run when the level actually changes, not on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.id]);

  useEffect(() => {
    onStepChange?.(stepIndex, schema.steps.length);
    // onStepChange isn't a dep on purpose — callers pass an inline closure;
    // re-firing on stepIndex/length change is all that's needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, schema.steps.length]);

  const step: LevelStep = schema.steps[stepIndex];
  const isLastStep = stepIndex === schema.steps.length - 1;

  // The registry is keyed by WidgetType with a per-key step type, but at
  // this call site `step` is the LevelStep union — TS can't re-derive the
  // per-key narrowing from a runtime `step.widgetType` lookup, so this cast
  // is the one unavoidable widening (same documented, accepted limitation
  // this file has always had). The widget itself still gets a precisely-
  // typed `schema` prop wherever it's authored.
  const Widget = widgetRegistry[
    step.widgetType
  ] as unknown as WidgetComponent<LevelStep>;

  const handleStepPass = async (rawInput: unknown) => {
    // For judge.kind === 'emulator' steps, rawInput is already a real
    // RunRequest (real assembled ELF bytes) — each emulator-judged widget
    // (fill-blank's register probe, drag-fill, freehand-editor) assembles
    // its own payload before calling onPass; see assembler/index.ts and
    // each widget's file header for how. LevelPlayer's job stays just
    // "run it, then judge the result" — widgets never judge themselves.
    const judgeInput =
      step.judge.kind === "emulator"
        ? await runEmulator(rawInput as RunRequest)
        : rawInput;

    const result = judgeStep(step, judgeInput);
    if (!result.pass) return;

    if (!isLastStep) {
      setStepIndex((i) => i + 1);
      return;
    }

    recordPass(schema.id);
    if (schema.onPass.reward) {
      grantReward(schema.onPass.reward, schema.id);
    }
    onAdvance(schema.onPass.advance);
  };

  return <Widget schema={step} onPass={handleStepPass} />;
}
