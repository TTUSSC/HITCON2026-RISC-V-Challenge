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
// per-line errors are rendered inline instead of calling onPass. Also passes
// through schema.files (see FreehandEditorStep.files in types.ts) to preload
// the emulator's virtual FS, mirroring DragOrderWidget's files handling —
// e.g. L2-4's open("flag.txt") needs a real flag.txt to exist.
//
// Execution feedback (added for the L2-Bonus rework — a wrong raw-bytes
// payload used to just produce "再試一次" with zero insight into what
// actually happened, violating level-design-principles.md's "emulator 已經
// 算出來的真實狀態必須被畫出來" rule):
//   - Once a real run has happened, `useEmulatorResult()` (see
//     engine/emulatorResultContext.ts, already wired up by LevelPlayer.tsx
//     for every emulator-judged step) exposes the real exit code + stdout —
//     always shown once available, no schema opt-in needed, so this is
//     backward-compatible for every existing freehand-editor level.
//   - schema.memoryWatch (opt-in, see types.ts) additionally previews the
//     bytes the player's *own* source placed at a given label+offset,
//     decoded straight from the just-assembled bytes (see readWatchedBytes
//     below for why this reads the assembler's output instead of asking the
//     guest program to self-report a register value).

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetDefinition";
import { defineWidget } from "../engine/widgetDefinition";
import type { FreehandEditorStep } from "../engine/types";
import { assemble, buildElf, formatAssembleErrors } from "../engine/assembler";
import { useSubmitState } from "../engine/submitState";
import { useEmulatorResult } from "../engine/emulatorResultContext";
import { RichText } from "./RichText";
import "./widgets.css";

// Decodes `size` little-endian bytes starting at `label`+`offset` out of a
// just-assembled program's byte array — i.e. exactly the bytes a runtime
// `lw`/`lb` at that address would load. Reading it back out of the
// assembler's own output (rather than having the *guest* program compute
// and print it) sidesteps a real hang risk: this platform's ISA subset has
// no shift instructions (see assembler/assemble.ts), so a guest-side
// decimal/hex conversion of an arbitrary 32-bit value would need a
// subtraction-based loop that could take billions of iterations on a wrong
// (garbage) payload. A static byte read is instant, has no such failure
// mode, and is exactly as truthful — those are the literal bytes that would
// get loaded. Returns null if the label doesn't exist or the range falls
// outside the assembled bytes (e.g. the player's payload was too short).
function readWatchedBytes(
  result: {
    bytes: Uint8Array;
    baseAddress: number;
    labels: Record<string, number>;
  },
  watch: NonNullable<FreehandEditorStep["memoryWatch"]>,
): number | null {
  const labelAddr = result.labels[watch.label];
  if (labelAddr === undefined) return null;
  const off = labelAddr + watch.offset - result.baseAddress;
  if (off < 0 || off + watch.size > result.bytes.length) return null;
  let value = 0;
  for (let i = watch.size - 1; i >= 0; i--) {
    value = value * 256 + result.bytes[off + i];
  }
  return value;
}

export const FreehandEditorWidget: WidgetComponent<FreehandEditorStep> = ({
  schema,
  onPass,
}) => {
  const [source, setSource] = useState(schema.starterCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [watchValue, setWatchValue] = useState<number | null>(null);
  const isRunning = useSubmitState() === "running";
  // The most recent real emulator run's result for this step, once one has
  // happened (both pass and fail — see emulatorResultContext.ts).
  const emulatorResult = useEmulatorResult();

  const handleRun = () => {
    const result = assemble(source);
    if (!result.ok) {
      setError(formatAssembleErrors(result.errors));
      setWatchValue(null);
      return;
    }
    setError(null);
    setWatchValue(
      schema.memoryWatch ? readWatchedBytes(result, schema.memoryWatch) : null,
    );
    const elf = buildElf(result.bytes, result.baseAddress, result.entry);
    const files = (schema.files ?? []).map((f) => ({
      path: f.path,
      data: new TextEncoder().encode(f.contents),
    }));
    onPass({ elf, files });
  };

  return (
    <div className="widget widget-freehand-editor">
      <h2>{schema.title}</h2>
      <RichText text={schema.prompt} />

      {/* Plain textarea by design — no CodeMirror/Monaco yet, see file header. */}
      <textarea
        className="freehand-editor-textarea"
        spellCheck={false}
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          if (error) setError(null);
          setWatchValue(null);
        }}
        rows={12}
      />

      {error && (
        <pre className="freehand-editor-error" role="alert">
          {error}
        </pre>
      )}

      {schema.memoryWatch && watchValue !== null && (
        <div className="freehand-editor-watch">
          <span className="freehand-editor-watch-label">
            {schema.memoryWatch.registerLabel}
          </span>
          <span className="freehand-editor-watch-value">
            0x
            {watchValue
              .toString(16)
              .padStart(schema.memoryWatch.size * 2, "0")}{" "}
            ({watchValue})
          </span>
        </div>
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

      {emulatorResult && (
        <div className="freehand-editor-result">
          <h3 className="freehand-editor-result-title">真的跑出來的結果</h3>
          <div className="freehand-editor-result-row">
            <span className="freehand-editor-result-key">exit code</span>
            <span className="freehand-editor-result-value">
              {emulatorResult.exitCode}
            </span>
          </div>
          <div className="freehand-editor-result-row">
            <span className="freehand-editor-result-key">stdout</span>
            <pre className="freehand-editor-result-stdout">
              {emulatorResult.stdout || "(空，什麼都沒印出來)"}
            </pre>
          </div>
        </div>
      )}
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
