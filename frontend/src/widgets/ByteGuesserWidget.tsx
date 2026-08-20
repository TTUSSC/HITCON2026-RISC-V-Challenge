// STUB — not yet implemented. Real byte-guesser interaction (manual byte
// guessing + one-click auto-solve for L3-2's canary leak, see
// docs/design/levels.md) is follow-up work. Registered here so
// widgetRegistry.tsx type-checks and is complete.

import type { WidgetComponent } from "../engine/widgetRegistry";
import type { ByteGuesserLevel } from "../engine/types";

export const ByteGuesserWidget: WidgetComponent<ByteGuesserLevel> = ({
  schema,
}) => {
  return (
    <div className="widget widget-stub">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      <p className="stub-notice">byte-guesser widget not yet implemented</p>
    </div>
  );
};
