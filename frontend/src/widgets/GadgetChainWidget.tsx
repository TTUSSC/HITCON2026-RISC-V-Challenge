// STUB — not yet implemented. Real gadget-chain interaction (click-to-chain
// gadget selection for L3-4, see docs/design/levels.md) is follow-up work.
// Registered here so widgetRegistry.tsx type-checks and is complete.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { GadgetChainLevel } from "../engine/types";

export const GadgetChainWidget: WidgetComponent<GadgetChainLevel> = ({
  schema,
}) => {
  return (
    <div className="widget widget-stub">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <p className="stub-notice">gadget-chain widget not yet implemented</p>
    </div>
  );
};
