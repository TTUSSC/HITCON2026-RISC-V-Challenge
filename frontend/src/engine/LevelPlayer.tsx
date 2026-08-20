// Looks up the right widget for a LevelSchema, renders it, and owns the
// judge/session-store wiring the widget itself must never do (see
// widgetRegistry.tsx / platform-architecture.md design principle #2).
//
// Flow: widget calls onPass(rawInput) -> LevelPlayer runs emulatorAdapter
// .run() first if judge.kind === 'emulator' (rawInput is then the RunRequest
// the level needs executed), then always calls judge(schema, ...) -> on pass,
// records progress in the session store and reports the next level id via
// onAdvance. Routing itself (react-router-dom) is out of scope here.

import { useEffect } from "react";
import type { LevelSchema } from "./types";
import type { RunRequest } from "./emulatorAdapter";
import { run as runEmulator } from "./emulatorAdapter";
import { judge } from "./judge";
import { useSessionStore } from "./sessionStore";
import { widgetRegistry, type WidgetComponent } from "./widgetRegistry";

export interface LevelPlayerProps {
  schema: LevelSchema;
  onAdvance: (nextLevelId: string | null) => void;
}

export function LevelPlayer({ schema, onAdvance }: LevelPlayerProps) {
  const enterLevel = useSessionStore((s) => s.enterLevel);
  const recordPass = useSessionStore((s) => s.recordPass);
  const grantReward = useSessionStore((s) => s.grantReward);

  useEffect(() => {
    enterLevel(schema.id);
    // Only re-run when the level actually changes, not on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.id]);

  // The registry is keyed by WidgetType with a per-key schema type, but at
  // this call site `schema` is the LevelSchema union — TS can't re-derive
  // the per-key narrowing from a runtime `schema.type` lookup, so this cast
  // is the one unavoidable widening. The widget itself still gets a
  // precisely-typed `schema` prop wherever it's authored.
  const Widget = widgetRegistry[
    schema.type
  ] as unknown as WidgetComponent<LevelSchema>;

  const handlePass = async (rawInput: unknown) => {
    // For judge.kind === 'emulator' levels, rawInput is already a real
    // RunRequest (real assembled ELF bytes) — each emulator-judged widget
    // (fill-blank's register probe, drag-fill, freehand-editor) assembles
    // its own payload before calling onPass; see assembler/index.ts and
    // each widget's file header for how. LevelPlayer's job stays just
    // "run it, then judge the result" — widgets never judge themselves.
    const judgeInput =
      schema.judge.kind === "emulator"
        ? await runEmulator(rawInput as RunRequest)
        : rawInput;

    const result = judge(schema, judgeInput);
    if (!result.pass) return;

    recordPass(schema.id);
    if (schema.onPass.reward) {
      grantReward(schema.onPass.reward, schema.id);
    }
    onAdvance(schema.onPass.advance);
  };

  return <Widget schema={schema} onPass={handlePass} />;
}
