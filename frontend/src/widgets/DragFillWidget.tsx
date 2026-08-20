// Drag-fill widget — mobile-first tap-to-select instead of native HTML5
// drag-and-drop. Native DnD is unreliable on touch devices (the primary
// input at a booth), so the interaction is: tap a slot to make it "active",
// then tap an option value to assign it into that slot (tapping the same
// slot again clears/reassigns). onPass hands back the raw
// Record<slotId, value> assignments — same shape as fill-blank's answer
// record — up to LevelPlayer. Per types.ts/judge.ts this widget's levels are
// always judge.kind 'emulator' (L2-1), so LevelPlayer needs to turn these
// raw assignments into an assembled RunRequest before running the emulator;
// see the TODO in LevelPlayer.tsx's emulator-run branch — that translation
// is out of scope here.

import { useState } from "react";
import { Check } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { DragFillLevel } from "../engine/types";
import "./widgets.css";

export const DragFillWidget: WidgetComponent<DragFillLevel> = ({
  schema,
  onPass,
}) => {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);

  const allFilled = schema.slots.every((slot) => assignments[slot.id]);

  const handleSlotTap = (slotId: string) => {
    setActiveSlot((prev) => (prev === slotId ? null : slotId));
  };

  const handleOptionTap = (value: string) => {
    if (!activeSlot) return;
    setAssignments((prev) => ({ ...prev, [activeSlot]: value }));
    setActiveSlot(null);
  };

  // Options are pooled across all slots (tap-to-select doesn't need to
  // distinguish where an option "came from" — every slot may reuse the same
  // pool of values).
  const allOptions = Array.from(
    new Set(schema.slots.flatMap((slot) => slot.options)),
  );

  return (
    <div className="widget widget-drag-fill">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>

      <div className="drag-fill-slots">
        {schema.slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className="drag-fill-slot"
            aria-pressed={activeSlot === slot.id}
            data-filled={Boolean(assignments[slot.id])}
            onClick={() => handleSlotTap(slot.id)}
          >
            <span className="drag-fill-slot-label">{slot.label}</span>
            <span className="drag-fill-slot-value">
              {assignments[slot.id] ?? "點選賦值"}
            </span>
          </button>
        ))}
      </div>

      <div className="drag-fill-options">
        {allOptions.map((option) => (
          <button
            key={option}
            type="button"
            className="drag-fill-option"
            disabled={!activeSlot}
            onClick={() => handleOptionTap(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="widget-primary-btn"
        disabled={!allFilled}
        onClick={() => onPass(assignments)}
      >
        <Check size={16} />
        Submit
      </button>
    </div>
  );
};
