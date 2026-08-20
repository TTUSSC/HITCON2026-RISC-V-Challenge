// Fill-in-the-blank widget — options only, no typing (mobile-friendly per
// levels.md). The primary visual is the real asm line (schema.asmLines) with
// the blank(s) rendered inline as dashed fill-in slots — not prose floating
// over unrelated option pills (content-design fix: this is meant to read as
// an actual asm crash course).
//
// For judge.kind === 'direct' levels (L1-2/L1-3 etc.), onPass hands the raw
// Record<blankId, chosenOption> up to LevelPlayer, which runs it through
// judge()'s 'fill-blank' direct comparator — same as before.
//
// For judge.kind === 'emulator' levels (L0-1..L0-3 — the ones whose judge
// condition in levels.md is a real "執行後暫存器值等於..." check), this
// widget assembles schema.setupAsmTemplate (falling back to
// asmLines.join("\n")) with the picked option(s) substituted in, wraps it
// with assembler/registerProbe.ts's register-probe harness, and hands
// LevelPlayer a RunRequest — LevelPlayer still owns the actual
// emulatorAdapter.run() + judge() call (widgets don't judge themselves).
// Assembly errors here are level-content bugs (curated snippets, not user
// input), so they're logged rather than shown as a user-facing message —
// contrast with FreehandEditorWidget, where the source is user-typed and
// errors are a real UX requirement.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { FillBlankStep } from "../engine/types";
import { RegisterBank } from "../components/RegisterBank";
import { tokenizeAsmLine, substituteAsmTemplate } from "../engine/asmTemplate";
import { assembleToElf } from "../engine/assembler";
import { buildRegisterProbeProgram } from "../engine/assembler/registerProbe";
import { useSubmitState } from "../engine/submitState";
import { RichText } from "./RichText";
import "./widgets.css";

export const FillBlankWidget: WidgetComponent<FillBlankStep> = ({
  schema,
  onPass,
}) => {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const submitState = useSubmitState();
  const isRunning = submitState === "running";

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

  const handleSubmit = () => {
    if (schema.judge.kind === "emulator") {
      const template =
        schema.setupAsmTemplate ?? (schema.asmLines ?? []).join("\n");
      const setupAsm = substituteAsmTemplate(template, selected);
      const checkRegister = schema.checkRegister ?? "a0";
      try {
        const elf = assembleToElf(
          buildRegisterProbeProgram(
            setupAsm,
            checkRegister,
            schema.probeExtraData,
          ),
        );
        onPass({ elf });
      } catch (err) {
        // Curated level content failed to assemble — a content bug, not a
        // user input error. Log it; there's nothing the player can fix.
        console.error(
          `FillBlankWidget: failed to assemble step "${schema.title}"`,
          err,
        );
      }
      return;
    }
    onPass(selected);
  };

  return (
    <div className="widget widget-fill-blank">
      <h2>{schema.title}</h2>
      <RichText text={schema.prompt} />
      {schema.registerContext && (
        <RegisterBank
          registers={schema.registerContext}
          values={registerValues}
          highlighted={highlighted}
        />
      )}
      {schema.asmLines && (
        <div className="fill-blank-code">
          {schema.asmLines.map((line, i) => (
            <div className="fill-blank-code-line" key={i}>
              {tokenizeAsmLine(line).map((token, j) =>
                token.kind === "text" ? (
                  <span key={j}>{token.value}</span>
                ) : (
                  <span
                    key={j}
                    className="fill-blank-slot"
                    data-empty={!selected[token.id]}
                  >
                    {selected[token.id] ?? "___"}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
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
        disabled={!allAnswered || isRunning}
        onClick={handleSubmit}
      >
        {isRunning ? <Loader2 size={16} className="spin" /> : "Submit"}
      </button>
    </div>
  );
};

// Direct-judge comparator, preserved byte-for-byte from the old
// judge.ts::directComparators['fill-blank'].
// eslint-disable-next-line react-refresh/only-export-components -- self-registration bundle (see widgetDefinition.ts)
export const fillBlankWidget = defineWidget<FillBlankStep>({
  type: "fill-blank",
  Component: FillBlankWidget,
  directJudge: (schema, input) => {
    const answers = input as Record<string, string> | undefined;
    if (!answers) return false;
    return schema.blanks.every((blank) => answers[blank.id] === blank.answer);
  },
});
