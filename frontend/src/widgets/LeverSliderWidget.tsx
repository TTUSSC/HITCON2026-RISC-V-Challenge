// Lever-slider widget — shared between L2-5a ("find the offset", judge.kind
// 'emulator': dragging is free, Submit assembles schema.asmTemplate with the
// current value and really runs it), and L3-1 ("feel the wall", no target,
// judge.kind 'none') per docs/design/levels.md. A plain <input type="range">
// styled with tokens plus a live value readout; when the step isn't graded
// (judge.kind 'none') there's nothing to check, so it's pure exploration
// with a "continue" button that calls onPass(undefined) directly instead of
// a graded submit.

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { LeverSliderStep } from "../engine/types";
import { StackDiagram } from "../components/StackDiagram";
import { assembleToElf } from "../engine/assembler";
import { substituteAsmTemplate } from "../engine/asmTemplate";
import { useSubmitState } from "../engine/submitState";
import { RichText } from "./RichText";
import "./widgets.css";

export const LeverSliderWidget: WidgetComponent<LeverSliderStep> = ({
  schema,
  onPass,
}) => {
  const [value, setValue] = useState<number>(schema.min);
  // Whether this step is graded at all (vs. L3-1's pure-feel judge.kind
  // 'none') — covers both judge.kind 'direct' (target-based) and 'emulator'
  // (asmTemplate-based) with the same Submit button; only 'none' degrades to
  // a plain Continue button.
  const isGraded = schema.judge.kind !== "none";
  const isRunning = useSubmitState() === "running";

  const handleSubmit = () => {
    if (schema.judge.kind === "emulator") {
      if (!schema.asmTemplate) {
        // Curated level content failed to set asmTemplate on an
        // emulator-judged step — a content bug, not a user input error.
        console.error(
          `LeverSliderWidget: judge.kind 'emulator' step "${schema.title}" has no asmTemplate`,
        );
        return;
      }
      const source = substituteAsmTemplate(schema.asmTemplate, {
        n: String(value),
      });
      try {
        const elf = assembleToElf(source);
        onPass({ elf, files: [] });
      } catch (err) {
        console.error(
          `LeverSliderWidget: failed to assemble step "${schema.title}"`,
          err,
        );
      }
      return;
    }
    onPass(value);
  };

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

      {isGraded ? (
        <button
          type="button"
          className="widget-primary-btn"
          disabled={isRunning}
          onClick={handleSubmit}
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
