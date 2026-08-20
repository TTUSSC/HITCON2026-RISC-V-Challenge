// Drag-order widget — thin wrapper over SortableJS via react-sortablejs, per
// platform-architecture.md's "技術棧" note (mirrors Khan Academy Perseus's
// `sorter` widget: widget only binds schema data, doesn't hand-roll
// touch/drag logic).
//
// Two judge shapes, same as FillBlankWidget/DragFillWidget:
//  - judge.kind === 'direct' (or 'none'): onPass hands the current order of
//    item ids straight up to LevelPlayer, which runs it through judge()'s
//    'drag-order' direct comparator.
//  - judge.kind === 'emulator': the player's chosen order determines the
//    concatenation order of each item's real asm (item.asm), assembled
//    between schema.asmPrefix/asmSuffix into a real ELF (mirrors
//    DragFillWidget's slot.optionAsm concatenation) plus any schema.files
//    preloaded into the emulator's FS — onPass hands the resulting
//    RunRequest up to LevelPlayer, which still owns the actual
//    emulatorAdapter.run() + judge() call. This widget never judges itself.

import { useState } from "react";
import { ReactSortable } from "react-sortablejs";
import { GripVertical, Check, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { DragOrderStep } from "../engine/types";
import { assembleToElf } from "../engine/assembler";
import { useSubmitState } from "../engine/submitState";
import { RichText } from "./RichText";
import "./widgets.css";

interface SortableItem {
  id: string;
  label: string;
}

export const DragOrderWidget: WidgetComponent<DragOrderStep> = ({
  schema,
  onPass,
}) => {
  const [items, setItems] = useState<SortableItem[]>(
    schema.items.map((item) => ({ id: item.id, label: item.label })),
  );
  const isRunning = useSubmitState() === "running";

  const handleSubmit = () => {
    if (schema.judge.kind !== "emulator") {
      onPass(items.map((item) => item.id));
      return;
    }
    const itemsById = Object.fromEntries(
      schema.items.map((item) => [item.id, item]),
    );
    const body = items.map((item) => itemsById[item.id]?.asm ?? "").join("\n");
    const source = `.text\n${schema.asmPrefix ?? ""}${body}\n${schema.asmSuffix ?? ""}`;
    try {
      const elf = assembleToElf(source);
      const files = (schema.files ?? []).map((f) => ({
        path: f.path,
        data: new TextEncoder().encode(f.contents),
      }));
      onPass({ elf, files });
    } catch (err) {
      console.error(
        `DragOrderWidget: failed to assemble step "${schema.title}"`,
        err,
      );
    }
  };

  return (
    <div className="widget widget-drag-order">
      <h2>{schema.title}</h2>
      <RichText text={schema.prompt} />
      <ReactSortable
        list={items}
        setList={setItems}
        animation={150}
        className="drag-order-list"
      >
        {items.map((item) => (
          <div key={item.id} className="drag-order-item">
            <GripVertical size={18} className="drag-order-handle" />
            <span>{item.label}</span>
          </div>
        ))}
      </ReactSortable>
      <button
        type="button"
        className="widget-primary-btn"
        disabled={isRunning}
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

// Direct-judge comparator, preserved byte-for-byte from the old
// judge.ts::directComparators['drag-order'].
// eslint-disable-next-line react-refresh/only-export-components -- self-registration bundle (see widgetDefinition.ts)
export const dragOrderWidget = defineWidget<DragOrderStep>({
  type: "drag-order",
  Component: DragOrderWidget,
  directJudge: (schema, input) => {
    const order = input as string[] | undefined;
    if (!order) return false;
    return (
      order.length === schema.correctOrder.length &&
      order.every((id, i) => id === schema.correctOrder[i])
    );
  },
});
