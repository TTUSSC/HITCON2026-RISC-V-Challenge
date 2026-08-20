// Type-safe map from WidgetType -> React component.
//
// Widgets only ever receive { schema, onPass } — they render and collect
// user input, they never call judge() or emulatorAdapter.run() themselves
// (see platform-architecture.md design principle #2: widget vs. judge are
// orthogonal, and the widget catalog's "onPass 把過關結果...往上交給 level
// engine" note). LevelPlayer is the layer that judges.

import type { ComponentType } from "react";
import type { LevelSchema, WidgetType } from "./types";

import { ObservationWidget } from "../widgets/ObservationWidget";
import { FillBlankWidget } from "../widgets/FillBlankWidget";
import { DragOrderWidget } from "../widgets/DragOrderWidget";
import { DragFillWidget } from "../widgets/DragFillWidget";
import { LeverSliderWidget } from "../widgets/LeverSliderWidget";
import { ByteGuesserWidget } from "../widgets/ByteGuesserWidget";
import { GadgetChainWidget } from "../widgets/GadgetChainWidget";
import { FreehandEditorWidget } from "../widgets/FreehandEditorWidget";

// Narrows LevelSchema down to the specific variant tagged with a given
// WidgetType, so each widget's `schema` prop is precisely typed (e.g.
// FillBlankLevel, not the full LevelSchema union).
export type LevelSchemaOf<T extends WidgetType> = Extract<
  LevelSchema,
  { type: T }
>;

// `result` is whatever raw input the corresponding judge.kind comparator
// needs — for judge.kind === 'emulator' widgets that's the raw payload to
// run, not an already-judged pass/fail (see task spec: widgets don't judge).
export type WidgetComponent<T extends LevelSchema> = ComponentType<{
  schema: T;
  onPass: (result: unknown) => void;
}>;

type WidgetRegistry = {
  [T in WidgetType]: WidgetComponent<LevelSchemaOf<T>>;
};

export const widgetRegistry: WidgetRegistry = {
  observation: ObservationWidget,
  "fill-blank": FillBlankWidget,
  "drag-order": DragOrderWidget,
  "drag-fill": DragFillWidget,
  "lever-slider": LeverSliderWidget,
  "byte-guesser": ByteGuesserWidget,
  "gadget-chain": GadgetChainWidget,
  "freehand-editor": FreehandEditorWidget,
};
