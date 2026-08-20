// Freehand-editor widget — L2-4/L2-Bonus/L3-Bonus's from-scratch assembly
// input. Deliberately a plain <textarea> (monospace, --font-mono) rather
// than a code-editor library (CodeMirror/Monaco) — that's a scope cut for
// this pass, not an oversight; worth reconsidering once syntax highlighting
// or inline error markers matter more than shipping the interaction.
//
// Per types.ts/judge.ts this widget is always judge.kind 'emulator'. Unlike
// the curated-content widgets (fill-blank/drag-fill, whose assembly always
// comes from hand-authored level data), this is raw user-typed text — real
// syntax errors are expected and must be surfaced, not swallowed (this was
// Codex's "no feedback" finding). On Run: assemble the source; on success,
// onPass hands the resulting RunRequest up to LevelPlayer (which still owns
// the actual emulatorAdapter.run() + judge() call — this widget only
// produces the payload, it doesn't judge itself); on failure, the assembler's
// per-line errors are rendered inline instead of calling onPass.

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { FreehandEditorStep } from "../engine/types";
import { assemble, buildElf, formatAssembleErrors } from "../engine/assembler";
import { useSubmitState } from "../engine/submitState";
import "./widgets.css";

export const FreehandEditorWidget: WidgetComponent<FreehandEditorStep> = ({
  schema,
  onPass,
}) => {
  const [source, setSource] = useState(schema.starterCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const isRunning = useSubmitState() === "running";

  const handleRun = () => {
    const result = assemble(source);
    if (!result.ok) {
      setError(formatAssembleErrors(result.errors));
      return;
    }
    setError(null);
    const elf = buildElf(result.bytes, result.baseAddress, result.entry);
    onPass({ elf });
  };

  return (
    <div className="widget widget-freehand-editor">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>

      {/* Plain textarea by design — no CodeMirror/Monaco yet, see file header. */}
      <textarea
        className="freehand-editor-textarea"
        spellCheck={false}
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          if (error) setError(null);
        }}
        rows={12}
      />

      {error && (
        <pre className="freehand-editor-error" role="alert">
          {error}
        </pre>
      )}

      <button
        type="button"
        className="widget-primary-btn"
        disabled={source.trim().length === 0 || isRunning}
        onClick={handleRun}
      >
        {isRunning ? (
          <Loader2 size={16} className="spin" />
        ) : (
          <Play size={16} />
        )}
        Run
      </button>
    </div>
  );
};

// No directJudge — freehand-editor is always judge.kind 'emulator'
// (L2-4/L2-Bonus/L3-Bonus).
// eslint-disable-next-line react-refresh/only-export-components -- self-registration bundle (see widgetDefinition.ts)
export const freehandEditorWidget = defineWidget<FreehandEditorStep>({
  type: "freehand-editor",
  Component: FreehandEditorWidget,
});
