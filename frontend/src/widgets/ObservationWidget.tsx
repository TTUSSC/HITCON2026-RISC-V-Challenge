// Pure observation/animation widget — no question, judge.kind is always
// 'none' for this type (see platform-architecture.md Widget Catalog).
// "Next" just advances; there is nothing to grade.

import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { ObservationStep } from "../engine/types";
import { RegisterBank } from "../components/RegisterBank";
import { MemoryCells } from "../components/MemoryCells";
import { CodeTrace } from "../components/CodeTrace";
import { StackDiagram } from "../components/StackDiagram";
import { RichText } from "./RichText";
import "./widgets.css";

export const ObservationWidget: WidgetComponent<ObservationStep> = ({
  schema,
  onPass,
}) => {
  return (
    <div className="widget widget-observation">
      <h2>{schema.title}</h2>
      <RichText text={schema.prompt} />
      {schema.registerContext && (
        <RegisterBank
          registers={schema.registerContext}
          values={schema.registerLabels}
          after={schema.registerAfter}
        />
      )}
      {schema.memoryVisual && (
        <MemoryCells
          baseRegister={schema.memoryVisual.baseRegister}
          baseValue={schema.memoryVisual.baseValue}
          cells={schema.memoryVisual.cells}
          bytesPerCell={schema.memoryVisual.bytesPerCell}
          highlightOffset={schema.memoryVisual.highlightOffset}
          direction={schema.memoryVisual.direction}
          targetRegister={schema.memoryVisual.targetRegister}
        />
      )}
      {schema.codeTrace && (
        <CodeTrace
          lines={schema.codeTrace.lines}
          currentLineId={schema.codeTrace.currentLineId}
          fallthroughLineId={schema.codeTrace.fallthroughLineId}
          takenLineId={schema.codeTrace.takenLineId}
          executedPath={schema.codeTrace.executedPath}
        />
      )}
      {schema.stackVisual && (
        <StackDiagram
          bufferSize={schema.stackVisual.bufferSize}
          mode={schema.stackVisual.mode}
          canarySize={schema.stackVisual.canarySize}
          savedS0Size={schema.stackVisual.savedS0Size}
          savedRaSize={schema.stackVisual.savedRaSize}
          fillLength={schema.stackVisual.fillLength}
        />
      )}
      <button
        type="button"
        className="widget-primary-btn"
        onClick={() => onPass(undefined)}
      >
        繼續
      </button>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- self-registration bundle (see widgetDefinition.ts)
export const observationWidget = defineWidget<ObservationStep>({
  type: "observation",
  Component: ObservationWidget,
});
