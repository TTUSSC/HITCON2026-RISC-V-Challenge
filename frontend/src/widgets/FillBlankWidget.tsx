// Fill-in-the-blank widget — options only, no typing (mobile-friendly per
// levels.md). Tracks selections locally; onPass hands the raw
// Record<blankId, chosenOption> up to LevelPlayer, which runs it through
// judge()'s 'fill-blank' direct comparator. This widget never grades itself.

import { useState } from "react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { FillBlankLevel } from "../engine/types";
import "./widgets.css";

export const FillBlankWidget: WidgetComponent<FillBlankLevel> = ({
  schema,
  onPass,
}) => {
  const [selected, setSelected] = useState<Record<string, string>>({});

  const allAnswered = schema.blanks.every((blank) => selected[blank.id]);

  return (
    <div className="widget widget-fill-blank">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      {schema.blanks.map((blank) => (
        <div key={blank.id} className="fill-blank-row">
          <span className="fill-blank-id">{blank.id}</span>
          <div className="fill-blank-options">
            {blank.options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={selected[blank.id] === option}
                onClick={() =>
                  setSelected((prev) => ({ ...prev, [blank.id]: option }))
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="widget-primary-btn"
        disabled={!allAnswered}
        onClick={() => onPass(selected)}
      >
        Submit
      </button>
    </div>
  );
};
