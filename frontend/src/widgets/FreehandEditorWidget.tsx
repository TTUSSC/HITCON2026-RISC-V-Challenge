// STUB — not yet implemented. Real freehand-editor interaction (free-form
// assembly typed in, actually assembled + run, see L2-4/L2-Bonus/L3-Bonus in
// docs/design/levels.md) is follow-up work. Registered here so
// widgetRegistry.tsx type-checks and is complete.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { FreehandEditorLevel } from "../engine/types";

export const FreehandEditorWidget: WidgetComponent<FreehandEditorLevel> = ({
  schema,
}) => {
  return (
    <div className="widget widget-stub">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <p className="stub-notice">freehand-editor widget not yet implemented</p>
    </div>
  );
};
