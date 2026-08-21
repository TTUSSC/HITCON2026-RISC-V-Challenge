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

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { EmulatorResult, LevelSchema, LevelStep } from "./types";
import type { RunRequest } from "./emulatorAdapter";
import { run as runEmulator } from "./emulatorAdapter";
import { judgeStep } from "./judge";
import { useSessionStore } from "./sessionStore";
import { widgetRegistry } from "./widgetRegistry";
import type { WidgetComponent } from "./widgetDefinition";
import type { SubmitState } from "./submitState";
import { SubmitStateContext } from "./submitState";
import { EmulatorResultContext } from "./emulatorResultContext";
import { RunStatusTicker } from "../components/RunStatusTicker";

// How long the 'wrong'/'correct' feedback state lingers before resetting
// (wrong -> back to 'idle' so the player can immediately retry) or advancing
// (correct -> the next step / level completion) — long enough to read the
// shake/bounce, short enough not to feel like a blocking modal. Halved when
// the player has requested reduced motion (see the useReducedMotion() call
// below) so the delay itself doesn't become the only "animation" left.
const WRONG_FEEDBACK_MS = 650;
const CORRECT_FEEDBACK_MS = 550;

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
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  // Set right after an emulator-judged step's run resolves (see
  // emulatorResultContext.ts's file header); reset to null below whenever
  // the visible step changes, same "adjust state during render" pattern as
  // trackedStepKey/submitState just above.
  const [lastEmulatorResult, setLastEmulatorResult] =
    useState<EmulatorResult | null>(null);
  const prefersReducedMotion = useReducedMotion();
  // Tracks the wrong/correct feedback timeout so a fast retry (submitting
  // again while the previous 'wrong' state is still winding down) doesn't
  // leave two competing timeouts racing to reset submitState.
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

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

  // Reset feedback state whenever the visible step changes (new level, or
  // advancing within one) — same "adjust state during render" pattern as
  // trackedLevelId above, avoids a set-state-in-effect cascade.
  const [trackedStepKey, setTrackedStepKey] = useState(
    `${schema.id}:${stepIndex}`,
  );
  const stepKey = `${schema.id}:${stepIndex}`;
  if (trackedStepKey !== stepKey) {
    setTrackedStepKey(stepKey);
    setSubmitState("idle");
    setLastEmulatorResult(null);
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

  const advanceToNextOrComplete = () => {
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

  const handleStepPass = async (rawInput: unknown) => {
    // judge.kind 'none' (observation, feel-only lever-slider) has nothing to
    // grade and no meaningful "wrong"/"running" state — advance immediately,
    // same as before this file gained submit-state feedback.
    if (step.judge.kind === "none") {
      advanceToNextOrComplete();
      return;
    }

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setSubmitState("running");

    // For judge.kind === 'emulator' steps, rawInput is already a real
    // RunRequest (real assembled ELF bytes) — each emulator-judged widget
    // (fill-blank's register probe, drag-fill, freehand-editor) assembles
    // its own payload before calling onPass; see assembler/index.ts and
    // each widget's file header for how. LevelPlayer's job stays just
    // "run it, then judge the result" — widgets never judge themselves.
    const emulatorResult =
      step.judge.kind === "emulator"
        ? await runEmulator(rawInput as RunRequest)
        : null;
    const judgeInput =
      step.judge.kind === "emulator" ? emulatorResult : rawInput;
    setLastEmulatorResult(emulatorResult);

    const result = judgeStep(step, judgeInput);

    if (!result.pass) {
      setSubmitState("wrong");
      feedbackTimeoutRef.current = setTimeout(
        () => setSubmitState("idle"),
        prefersReducedMotion ? WRONG_FEEDBACK_MS / 2 : WRONG_FEEDBACK_MS,
      );
      return;
    }

    setSubmitState("correct");
    feedbackTimeoutRef.current = setTimeout(
      () => {
        setSubmitState("idle");
        advanceToNextOrComplete();
      },
      prefersReducedMotion ? CORRECT_FEEDBACK_MS / 2 : CORRECT_FEEDBACK_MS,
    );
  };

  // Shake on wrong, a satisfying pop/bounce on correct — a plain style-class
  // swap would be an instant snap, not the "deliberate small motion" the
  // design calls for (see docs/design/STYLE.md's 動畫 section). This used to
  // be a framer-motion x-shake/scale-bounce applied straight to this wrap —
  // but `.widget-primary-btn` (rendered inside <Widget>, so a descendant of
  // this wrap) is `position: fixed`, and CSS makes ANY transformed ancestor
  // the containing block for a fixed descendant. That reanchored the button
  // to this wrap's own (much smaller) box for the animation's duration,
  // making it visibly jump — see widgets.css's `.widget-primary-btn`
  // comment. The actual shake/bounce now lives in pure CSS
  // (`.widget-feedback-wrap[data-submit-state=...] .widget >
  // *:not(.widget-primary-btn)` in widgets.css), which animates `.widget`'s
  // children individually instead of transforming any ancestor of the
  // button. This wrap only still needs the opacity pulse for reduced
  // motion (useReducedMotion() above) — opacity never hijacks a fixed
  // descendant's containing block, so it's always safe here, and the CSS
  // shake/bounce rules are themselves scoped to
  // `prefers-reduced-motion: no-preference` as a second guard.
  const feedbackAnimate = prefersReducedMotion
    ? {
        opacity: submitState === "wrong" || submitState === "correct" ? 0.7 : 1,
      }
    : { opacity: 1 };

  return (
    <SubmitStateContext.Provider value={submitState}>
      <EmulatorResultContext.Provider value={lastEmulatorResult}>
        <motion.div
          className="widget-feedback-wrap"
          data-submit-state={submitState}
          animate={feedbackAnimate}
          transition={{ duration: prefersReducedMotion ? 0.15 : 0.4 }}
        >
          {/* key=stepKey forces a full remount on every step change — without
              it, two consecutive steps sharing a widgetType (e.g. two
              fill-blank or two drag-order steps in a row) reuse the same
              component instance, so its internal useState (picked answers,
              drag order, slider value, typed code) never re-initializes and
              silently carries over from the previous step. */}
          <Widget key={stepKey} schema={step} onPass={handleStepPass} />
          {submitState === "running" && <RunStatusTicker />}
          <AnimatePresence>
            {submitState === "wrong" && (
              <motion.div
                className="widget-feedback-message"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
              >
                再試一次
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </EmulatorResultContext.Provider>
    </SubmitStateContext.Provider>
  );
}
