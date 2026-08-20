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
import { MemoryCells } from "../components/MemoryCells";
import { CodeTrace } from "../components/CodeTrace";
import { tokenizeAsmLine, substituteAsmTemplate } from "../engine/asmTemplate";
import { assembleToElf } from "../engine/assembler";
import { buildRegisterProbeProgram } from "../engine/assembler/registerProbe";
import { useSubmitState } from "../engine/submitState";
import { useEmulatorResult } from "../engine/emulatorResultContext";
import { RichText } from "./RichText";
import "./widgets.css";

export const FillBlankWidget: WidgetComponent<FillBlankStep> = ({
  schema,
  onPass,
}) => {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const submitState = useSubmitState();
  const isRunning = submitState === "running";
  // The real EmulatorResult from this step's most recent run, once one has
  // happened (see engine/emulatorResultContext.ts) — lets a resolved step
  // show the actual post-run register value instead of a guess, per
  // cogload-review-L0.md's L0-1 §4 finding.
  const emulatorResult = useEmulatorResult();

  const allAnswered = schema.blanks.every((blank) => selected[blank.id]);

  // Two shapes of register blank, both handled here:
  //  - the *chosen option* NAMES a register (L1-2/L1-4: "which register
  //    holds the syscall number / return address?") -> show the real
  //    numeric value that register would hold once the setup asm actually
  //    runs, read from the same judge.expect.registers data that judges the
  //    step (see level-review-L1.md §0 Addition 2) — not an echo of the
  //    picked option string. A wrong pick shows "?" rather than a fabricated
  //    number, since we only know the real value for the register the step
  //    actually checks.
  //  - blank.id IS a register in registerContext and the options are values
  //    (L1-3: "set a0 to ___" -> show the chosen value in a0's box).
  // Checked in this order because a blank's id can itself be a register name
  // whose *options* are also register names (L1-2's blank id is "a7"), in
  // which case the "chosen option names a register" reading is the correct
  // one (see the review's exact bug report on this).
  //
  // registerValues seeds from schema.registerBefore (known initial state,
  // e.g. L0-2's a1 = 7 setup the player never otherwise sees) so a "before"
  // value is visible even before anything is picked. registerAfter only
  // gets populated once a real run has happened — RegisterBank renders a
  // before -> after transition for any register present in both.
  const registerValues: Partial<Record<string, string>> = {
    ...(schema.registerBefore ?? {}),
  };
  const registerAfter: Partial<Record<string, string>> = {};
  let highlighted: string | undefined;
  if (schema.registerContext) {
    const expectedRegisters =
      schema.judge.kind === "emulator"
        ? schema.judge.expect.registers
        : undefined;
    for (const blank of schema.blanks) {
      const chosen = selected[blank.id];
      if (!chosen) continue;
      if (schema.registerContext.includes(chosen)) {
        highlighted = chosen;
        const real = emulatorResult?.registers[chosen];
        if (real !== undefined) {
          registerValues[chosen] = String(real);
        } else if (registerValues[chosen] === undefined) {
          const guess = expectedRegisters?.[chosen];
          registerValues[chosen] = guess !== undefined ? String(guess) : "?";
        }
      } else if (schema.registerContext.includes(blank.id)) {
        registerValues[blank.id] = chosen;
        highlighted = blank.id;
      }
    }
    // Once a real run has happened, overlay every registerContext register's
    // *actual* reported value (registerProbe.ts always reports checkRegister,
    // so this is what finally makes e.g. L0-1's a0 box show "— -> 5" for
    // real instead of never updating at all — see the review's exact bug
    // report that registerContext alone did not achieve this).
    if (emulatorResult) {
      for (const reg of schema.registerContext) {
        const real = emulatorResult.registers[reg];
        if (real !== undefined) {
          registerAfter[reg] = String(real);
          highlighted = highlighted ?? reg;
        }
      }
    }
  }

  // Gated on submitState === 'correct', not just emulatorResult being
  // present: schema.codeTrace.executedPath is the path a *correct* pick
  // takes, declared statically in level content, not inferred from the raw
  // result — a wrong pick still produces an emulatorResult (so it can fail
  // the judge), but revealing "executedPath: taken" on a wrong pick would
  // be showing a fabricated outcome, not the pick's real one. See types.ts's
  // FillBlankStep.codeTrace doc comment.
  const codeTraceExecutedPath =
    submitState === "correct" && schema.codeTrace
      ? schema.codeTrace.executedPath
      : undefined;
  // codeTrace line text may itself use the same "{{blankId}}" placeholder
  // as asmLines (e.g. L0-4's practice steps swap the opcode) — substitute
  // the picked option same as the inline asm rendering does, showing "___"
  // instead of an empty string for an unanswered blank so the placeholder
  // doesn't just vanish.
  const codeTraceLines = schema.codeTrace?.lines.map((line) => ({
    ...line,
    text: substituteAsmTemplate(
      line.text,
      Object.fromEntries(
        schema.blanks.map((b) => [b.id, selected[b.id] ?? "___"]),
      ),
    ),
  }));

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
          after={registerAfter}
          highlighted={highlighted}
        />
      )}
      {schema.memoryVisual && (
        <MemoryCells
          baseRegister={schema.memoryVisual.baseRegister}
          baseValue={schema.memoryVisual.baseValue}
          cells={schema.memoryVisual.cells}
          bytesPerCell={schema.memoryVisual.bytesPerCell}
          highlightOffset={schema.memoryVisual.highlightOffset}
          direction={schema.memoryVisual.direction}
          targetRegister={schema.memoryVisual.targetRegister}
        />
      )}
      {schema.codeTrace && codeTraceLines && (
        <CodeTrace
          lines={codeTraceLines}
          currentLineId={schema.codeTrace.currentLineId}
          fallthroughLineId={schema.codeTrace.fallthroughLineId}
          takenLineId={schema.codeTrace.takenLineId}
          executedPath={codeTraceExecutedPath}
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
