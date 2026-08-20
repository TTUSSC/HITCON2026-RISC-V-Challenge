// Lever-slider widget — shared between L2-5a ("find the offset", has a
// target, judge.kind 'direct') and L3-1 ("feel the wall", no target,
// judge.kind 'none') per docs/design/levels.md. A plain <input type="range">
// styled with tokens plus a live value readout; when schema.target is
// undefined there's nothing to grade, so it's pure exploration with a
// "continue" button that calls onPass(undefined) directly instead of a
// graded submit.

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { LeverSliderStep } from "../engine/types";
import { StackDiagram } from "../components/StackDiagram";
import { useSubmitState } from "../engine/submitState";
import { RichText } from "./RichText";
import "./widgets.css";

export const LeverSliderWidget: WidgetComponent<LeverSliderStep> = ({
  schema,
  onPass,
}) => {
  const [value, setValue] = useState<number>(schema.min);
  const hasTarget = schema.target !== undefined;
  const isRunning = useSubmitState() === "running";

  return (
    <div className="widget widget-lever-slider">
      <h2>{schema.title}</h2>
      <RichText text={schema.prompt} />

      {schema.stackVisual && (
        <StackDiagram
          bufferSize={schema.stackVisual.bufferSize}
          mode={schema.stackVisual.mode}
          canarySize={schema.stackVisual.canarySize}
          savedS0Size={schema.stackVisual.savedS0Size}
          savedRaSize={schema.stackVisual.savedRaSize}
          fillLength={value}
        />
      )}

      <div className="lever-slider-readout">{value}</div>
      <input
        type="range"
        className="lever-slider"
        min={schema.min}
        max={schema.max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <div className="lever-slider-bounds">
        <span>{schema.min}</span>
        <span>{schema.max}</span>
      </div>

      {hasTarget ? (
        <button
          type="button"
          className="widget-primary-btn"
          disabled={isRunning}
          onClick={() => onPass(value)}
        >
          {isRunning ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          Submit
        </button>
      ) : (
        <button
          type="button"
          className="widget-primary-btn"
          onClick={() => onPass(undefined)}
        >
          <ArrowRight size={16} />
          Continue
        </button>
      )}
    </div>
  );
};

// Direct-judge comparator, preserved byte-for-byte from the old
// judge.ts::directComparators['lever-slider'].
// eslint-disable-next-line react-refresh/only-export-components -- self-registration bundle (see widgetDefinition.ts)
export const leverSliderWidget = defineWidget<LeverSliderStep>({
  type: "lever-slider",
  Component: LeverSliderWidget,
  directJudge: (schema, input) => {
    if (schema.target === undefined) return false; // e.g. L3-1 has no target
    return input === schema.target;
  },
});
