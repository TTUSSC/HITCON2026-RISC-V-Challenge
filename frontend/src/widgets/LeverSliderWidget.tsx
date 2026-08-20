// STUB — not yet implemented. Real lever-slider interaction (shared
// component between L2-5a "find the offset" and L3-1 "feel the crash", see
// docs/design/levels.md) is follow-up work. Registered here so
// widgetRegistry.tsx type-checks and is complete.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { LeverSliderLevel } from "../engine/types";

export const LeverSliderWidget: WidgetComponent<LeverSliderLevel> = ({
  schema,
}) => {
  return (
    <div className="widget widget-stub">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <p className="stub-notice">lever-slider widget not yet implemented</p>
    </div>
  );
};
