// Freehand-editor widget — L2-4/L2-Bonus/L3-Bonus's from-scratch assembly
// input. Deliberately a plain <textarea> (monospace, --font-mono) rather
// than a code-editor library (CodeMirror/Monaco) — that's a scope cut for
// this pass, not an oversight; worth reconsidering once syntax highlighting
// or inline error markers matter more than shipping the interaction.
// onPass hands the raw source text up to LevelPlayer. Per
// types.ts/judge.ts this widget is always judge.kind 'emulator', so
// LevelPlayer needs to turn the raw text into an assembled RunRequest (real
// ELF bytes) before running the emulator — see the TODO in LevelPlayer.tsx's
// emulator-run branch; assembling arbitrary user asm is out of scope here.

import { useState } from "react";
import { Play } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { FreehandEditorLevel } from "../engine/types";
import "./widgets.css";

export const FreehandEditorWidget: WidgetComponent<FreehandEditorLevel> = ({
  schema,
  onPass,
}) => {
  const [source, setSource] = useState(schema.starterCode ?? "");

  return (
    <div className="widget widget-freehand-editor">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>

      {/* Plain textarea by design — no CodeMirror/Monaco yet, see file header. */}
      <textarea
        className="freehand-editor-textarea"
        spellCheck={false}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={12}
      />

      <button
        type="button"
        className="widget-primary-btn"
        disabled={source.trim().length === 0}
        onClick={() => onPass(source)}
      >
        <Play size={16} />
        Run
      </button>
    </div>
  );
};
