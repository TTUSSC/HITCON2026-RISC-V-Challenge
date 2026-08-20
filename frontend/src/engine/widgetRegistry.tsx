// Thin aggregator: collects each widget's self-registration object (see
// widgetDefinition.ts) and builds the two lookup tables the rest of the
// engine needs — WidgetType -> Component (for LevelPlayer to render) and
// WidgetType -> directJudge (for judge.ts's 'direct' judge.kind branch).
// This file (plus widgetDefinition.ts) is Phase 2.5's single source of
// truth: adding/changing a widget touches its own file + one import line
// here, not three separately-maintained maps.

import type { LevelStep, WidgetType } from "./types";
import type { WidgetComponent, WidgetDefinition } from "./widgetDefinition";

import { observationWidget } from "../widgets/ObservationWidget";
import { fillBlankWidget } from "../widgets/FillBlankWidget";
import { dragOrderWidget } from "../widgets/DragOrderWidget";
import { dragFillWidget } from "../widgets/DragFillWidget";
import { leverSliderWidget } from "../widgets/LeverSliderWidget";
import { byteGuesserWidget } from "../widgets/ByteGuesserWidget";
import { gadgetChainWidget } from "../widgets/GadgetChainWidget";
import { freehandEditorWidget } from "../widgets/FreehandEditorWidget";

export type { WidgetComponent } from "./widgetDefinition";

// Each entry is a WidgetDefinition<T> for a *different* T (one per widget
// type) — there is no single T that describes the whole list, so the array
// element type is deliberately widened to `never`'s dual, `unknown`'s
// discriminated-union sibling: LevelStep as a whole. This is the one
// unavoidable widening, mirrored by the equally-unavoidable cast below it
// (same spirit as LevelPlayer.tsx's documented widget-lookup cast).
const definitions: Array<WidgetDefinition<LevelStep>> = [
  observationWidget,
  fillBlankWidget,
  dragOrderWidget,
  dragFillWidget,
  leverSliderWidget,
  byteGuesserWidget,
  gadgetChainWidget,
  freehandEditorWidget,
] as unknown as Array<WidgetDefinition<LevelStep>>;

type WidgetRegistryMap = {
  [T in WidgetType]: WidgetComponent<Extract<LevelStep, { widgetType: T }>>;
};

export const widgetRegistry = Object.fromEntries(
  definitions.map((d) => [d.type, d.Component]),
) as unknown as WidgetRegistryMap;

export type DirectJudge = (step: LevelStep, input: unknown) => boolean;

// Only the four widget types that support judge.kind 'direct' show up here
// (fill-blank, lever-slider, gadget-chain, drag-order) — see each widget
// file's defineWidget() call for which ones opt in.
export const directJudges: Partial<Record<WidgetType, DirectJudge>> =
  Object.fromEntries(
    definitions
      .filter((d) => d.directJudge)
      .map((d) => [d.type, d.directJudge as DirectJudge]),
  );
