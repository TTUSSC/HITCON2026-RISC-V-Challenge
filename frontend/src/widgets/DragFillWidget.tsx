// STUB — not yet implemented. Real drag-fill interaction (drag address/
// length into register slots, assembled + run through the emulator, see
// L2-1 in docs/design/levels.md) is follow-up work. Registered here so
// widgetRegistry.tsx type-checks and is complete.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { DragFillLevel } from "../engine/types";

export const DragFillWidget: WidgetComponent<DragFillLevel> = ({ schema }) => {
  return (
    <div className="widget widget-stub">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <p className="stub-notice">drag-fill widget not yet implemented</p>
    </div>
  );
};
