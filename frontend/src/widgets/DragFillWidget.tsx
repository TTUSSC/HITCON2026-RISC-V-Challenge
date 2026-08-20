// Drag-fill widget — mobile-first tap-to-select instead of native HTML5
// drag-and-drop. Native DnD is unreliable on touch devices (the primary
// input at a booth), so the interaction is: tap a slot to make it "active",
// then tap an option value to assign it into that slot (tapping the same
// slot again clears/reassigns).
//
// Per types.ts/judge.ts this widget's levels are always judge.kind
// 'emulator' (L2-1): each slot's chosen option maps to real asm
// (slot.optionAsm), concatenated in slot order between schema.asmPrefix/
// asmSuffix and assembled here into a RunRequest, which onPass hands up to
// LevelPlayer — LevelPlayer still owns the actual emulatorAdapter.run() +
// judge() call, this widget only produces the payload to run (not a
// judgement), same division of labor as FreehandEditorWidget.

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { DragFillStep } from "../engine/types";
import { assembleToElf } from "../engine/assembler";
import { useSubmitState } from "../engine/submitState";
import "./widgets.css";

export const DragFillWidget: WidgetComponent<DragFillStep> = ({
  schema,
  onPass,
}) => {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const isRunning = useSubmitState() === "running";

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

  const handleSubmit = () => {
    const body = schema.slots
      .map((slot) => slot.optionAsm?.[assignments[slot.id]] ?? "")
      .join("\n");
    const source = `.text\n${schema.asmPrefix ?? ""}${body}\n${schema.asmSuffix ?? ""}`;
    try {
      const elf = assembleToElf(source);
      onPass({ elf });
    } catch (err) {
      console.error(
        `DragFillWidget: failed to assemble step "${schema.title}"`,
        err,
      );
    }
  };

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
        disabled={!allFilled || isRunning}
        onClick={handleSubmit}
      >
        {isRunning ? (
          <Loader2 size={16} className="spin" />
        ) : (
          <Check size={16} />
        )}
        Submit
      </button>
    </div>
  );
};

// No directJudge — drag-fill is always judge.kind 'emulator' (L2-1 et al.):
// the payload is really assembled and run, see handleSubmit above.
// eslint-disable-next-line react-refresh/only-export-components -- self-registration bundle (see widgetDefinition.ts)
export const dragFillWidget = defineWidget<DragFillStep>({
  type: "drag-fill",
  Component: DragFillWidget,
});
