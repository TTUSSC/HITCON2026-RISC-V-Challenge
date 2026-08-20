// Pure observation/animation widget — no question, judge.kind is always
// 'none' for this type (see platform-architecture.md Widget Catalog).
// "Next" just advances; there is nothing to grade.

import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { ObservationStep } from "../engine/types";
import { RegisterBank } from "../components/RegisterBank";
import "./widgets.css";

export const ObservationWidget: WidgetComponent<ObservationStep> = ({
  schema,
  onPass,
}) => {
  return (
    <div className="widget widget-observation">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      {schema.registerContext && (
        <RegisterBank
          registers={schema.registerContext}
          values={schema.registerLabels}
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
