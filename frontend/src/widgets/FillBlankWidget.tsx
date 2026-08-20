// Fill-in-the-blank widget — options only, no typing (mobile-friendly per
// levels.md). Tracks selections locally; onPass hands the raw
// Record<blankId, chosenOption> up to LevelPlayer, which runs it through
// judge()'s 'fill-blank' direct comparator. This widget never grades itself.

import { useState } from "react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { FillBlankLevel } from "../engine/types";
import { RegisterBank } from "../components/RegisterBank";
import "./widgets.css";

export const FillBlankWidget: WidgetComponent<FillBlankLevel> = ({
  schema,
  onPass,
}) => {
  const [selected, setSelected] = useState<Record<string, string>>({});

  const allAnswered = schema.blanks.every((blank) => selected[blank.id]);

  // Two shapes of register blank, both handled here:
  //  - blank.id IS a register in registerContext and the options are values
  //    (L1-3: "set a0 to ___" -> show the chosen value in a0's box), or
  //  - the *chosen option* is a register name (L1-2: "which register holds
  //    the syscall number?" -> highlight whichever register got picked).
  const registerValues: Partial<Record<string, string>> = {};
  let highlighted: string | undefined;
  if (schema.registerContext) {
    for (const blank of schema.blanks) {
      const chosen = selected[blank.id];
      if (!chosen) continue;
      if (schema.registerContext.includes(blank.id)) {
        registerValues[blank.id] = chosen;
        highlighted = blank.id;
      } else if (schema.registerContext.includes(chosen)) {
        registerValues[chosen] = blank.id;
        highlighted = chosen;
      }
    }
  }

  return (
    <div className="widget widget-fill-blank">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>
      {schema.registerContext && (
        <RegisterBank
          registers={schema.registerContext}
          values={registerValues}
          highlighted={highlighted}
        />
      )}
      {schema.blanks.map((blank) => (
        <div key={blank.id} className="fill-blank-row">
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
