// STUB — not yet implemented. Real drag-order interaction (SortableJS
// binding, see platform-architecture.md "技術棧") is follow-up work.
// Registered here so widgetRegistry.tsx type-checks and is complete.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { DragOrderLevel } from "../engine/types";

export const DragOrderWidget: WidgetComponent<DragOrderLevel> = ({
  schema,
}) => {
  return (
    <div className="widget widget-stub">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <p className="stub-notice">drag-order widget not yet implemented</p>
    </div>
  );
};
