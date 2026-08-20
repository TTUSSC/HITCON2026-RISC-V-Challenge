// Small shared read channel LevelPlayer uses to tell the widget it's
// wrapping (and the feedback shell around it) what the current answer
// submission is doing — 'running' while emulatorAdapter.run() is in flight,
// 'wrong'/'correct' briefly after judging, back to 'idle' otherwise.
// LevelPlayer owns the shake/bounce feedback shell and the actual judging
// (see LevelPlayer.tsx's handleStepPass) — a widget only reads this via
// useSubmitState() to disable/spin its own submit button while 'running' so
// a slow emulator run can't be double-submitted. This is deliberately a
// read-only channel, not a way for widgets to affect judging — keeps the
// widget-vs-judge orthogonality principle from widgetDefinition.ts intact.

import { createContext, useContext } from "react";

export type SubmitState = "idle" | "running" | "wrong" | "correct";

export const SubmitStateContext = createContext<SubmitState>("idle");

export function useSubmitState(): SubmitState {
  return useContext(SubmitStateContext);
}
