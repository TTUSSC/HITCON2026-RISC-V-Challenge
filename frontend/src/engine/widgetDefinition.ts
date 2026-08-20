// Per-widget self-registration ("Phase 2.5"). Each widget file owns its full
// definition — component, and (where applicable) the direct-judge comparator
// — as a single object built with defineWidget(), instead of the type being
// declared in types.ts, the component wired in widgetRegistry.tsx, and the
// direct-judge comparator wired separately in judge.ts. That three-way split
// is exactly how L2-1 once drifted (mislabeled between widget type and judge
// kind, see platform-architecture.md's Widget Catalog note) — collapsing it
// to one bundle per widget file means adding/changing a widget only touches
// that one file plus a one-line import in widgetRegistry.tsx.
//
// `directJudge` is only present for widget types that support
// `judge.kind: 'direct'` (fill-blank, lever-slider, gadget-chain,
// drag-order). Widgets that only ever run under `judge.kind: 'emulator'`
// (drag-fill, freehand-editor, byte-guesser) and `observation` (always
// `judge.kind: 'none'`) omit it. `judge.kind: 'emulator'` grading itself
// (comparing EmulatorResult against EmulatorExpectation) is generic, not
// per-widget — that stays in judge.ts's judgeEmulatorResult, not here.

import type { ComponentType } from "react";
import type { LevelStep, WidgetType } from "./types";

// Narrows LevelStep down to the specific variant tagged with a given
// WidgetType, so each widget's `schema` prop is precisely typed (e.g.
// FillBlankStep, not the full LevelStep union).
export type LevelStepOf<T extends WidgetType> = Extract<
  LevelStep,
  { widgetType: T }
>;

// `result` is whatever raw input the corresponding judge.kind needs — for
// judge.kind === 'emulator' widgets that's the raw payload to run, not an
// already-judged pass/fail (widgets don't judge themselves).
export type WidgetComponent<T extends LevelStep> = ComponentType<{
  schema: T;
  onPass: (result: unknown) => void;
}>;

export interface WidgetDefinition<T extends LevelStep> {
  type: T["widgetType"];
  Component: WidgetComponent<T>;
  directJudge?: (step: T, input: unknown) => boolean;
}

// Identity function at runtime — exists purely so each widget file gets a
// single type-checked call site tying its Component to its own step type
// (and directJudge, if any) instead of three loosely-related exports.
export function defineWidget<T extends LevelStep>(
  def: WidgetDefinition<T>,
): WidgetDefinition<T> {
  return def;
}
