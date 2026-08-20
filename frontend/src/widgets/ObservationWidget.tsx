// Pure observation/animation widget — no question, judge.kind is always
// 'none' for this type (see platform-architecture.md Widget Catalog).
// "Next" just advances; there is nothing to grade.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { ObservationLevel } from "../engine/types";

export const ObservationWidget: WidgetComponent<ObservationLevel> = ({
  schema,
  onPass,
}) => {
  return (
    <div className="widget widget-observation">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <button type="button" onClick={() => onPass(undefined)}>
        Next
      </button>
    </div>
  );
};
