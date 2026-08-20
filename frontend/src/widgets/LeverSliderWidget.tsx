// Lever-slider widget — shared between L2-5a ("find the offset", has a
// target, judge.kind 'direct') and L3-1 ("feel the wall", no target,
// judge.kind 'none') per docs/design/levels.md. A plain <input type="range">
// styled with tokens plus a live value readout; when schema.target is
// undefined there's nothing to grade, so it's pure exploration with a
// "continue" button that calls onPass(undefined) directly instead of a
// graded submit.

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { LeverSliderLevel } from "../engine/types";
import "./widgets.css";

export const LeverSliderWidget: WidgetComponent<LeverSliderLevel> = ({
  schema,
  onPass,
}) => {
  const [value, setValue] = useState<number>(schema.min);
  const hasTarget = schema.target !== undefined;

  return (
    <div className="widget widget-lever-slider">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>

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
          onClick={() => onPass(value)}
        >
          <Check size={16} />
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
