// Drag-order widget — thin wrapper over SortableJS via react-sortablejs, per
// platform-architecture.md's "技術棧" note (mirrors Khan Academy Perseus's
// `sorter` widget: widget only binds schema data, doesn't hand-roll
// touch/drag logic). onPass hands the current order of item ids up to
// LevelPlayer, which runs it through judge()'s 'drag-order' direct
// comparator. This widget never grades itself.

import { useState } from "react";
import { ReactSortable } from "react-sortablejs";
import { GripVertical, Check } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { DragOrderStep } from "../engine/types";
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

  return (
    <div className="widget widget-drag-order">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
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
        onClick={() => onPass(items.map((item) => item.id))}
      >
        <Check size={16} />
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
