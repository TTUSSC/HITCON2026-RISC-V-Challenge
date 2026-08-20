// Byte-guesser widget — L3-2's canary leak. Manual mode: one hex-byte input
// (0-255) per position, submitted one at a time ("每次重跑都是全新 emulator
// instance" per levels.md — a real guess re-runs the target ELF with the
// candidate byte and checks whether it survived or hit stack-smashing).
// Auto mode: a one-click "自動跑完剩下的" that brute-forces the remaining
// positions.
//
// The real per-guess check needs emulatorAdapter.run() against a compiled
// vulnerable ELF, but the WASM assets aren't wired into frontend/public/ yet
// (see emulatorAdapter.ts's own TODO). This widget implements the full UI
// state machine — entering bytes, a "guessed so far" list, manual vs. auto
// mode — against a stubbed async guess function so it's interactive without
// a real emulator underneath yet.

import { useState } from "react";
import { Check, Zap, Loader2 } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { ByteGuesserLevel } from "../engine/types";
import "./widgets.css";

// TODO: wire emulatorAdapter.run() once WASM assets are in public/ — a real
// guess re-runs the target ELF with `bytesSoFar + [candidate]` as stdin and
// reports whether the process survived (correct byte) or crashed with
// stack-smashing detected (wrong byte).
async function stubGuessByte(): Promise<{ correct: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  // Placeholder: accepts whatever the user/auto-loop typed so the UI state
  // machine is fully exercisable without a real emulator underneath.
  return { correct: true };
}

interface GuessRecord {
  position: number;
  value: number;
  correct: boolean;
}

export const ByteGuesserWidget: WidgetComponent<ByteGuesserLevel> = ({
  schema,
  onPass,
}) => {
  const [bytes, setBytes] = useState<Array<number | null>>(
    Array.from({ length: schema.byteCount }, () => null),
  );
  const [inputs, setInputs] = useState<string[]>(
    Array.from({ length: schema.byteCount }, () => ""),
  );
  const [history, setHistory] = useState<GuessRecord[]>([]);
  const [busyPosition, setBusyPosition] = useState<number | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);

  const allGuessed = bytes.every((b) => b !== null);

  const guessOne = async (position: number, candidate: number) => {
    setBusyPosition(position);
    const { correct } = await stubGuessByte();
    setHistory((prev) => [...prev, { position, value: candidate, correct }]);
    if (correct) {
      setBytes((prev) => {
        const next = [...prev];
        next[position] = candidate;
        return next;
      });
    }
    setBusyPosition(null);
    return correct;
  };

  const handleManualGuess = (position: number) => {
    const parsed = Number(inputs[position]);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 255) return;
    void guessOne(position, parsed);
  };

  const handleAutoSolve = async () => {
    setAutoRunning(true);
    for (let position = 0; position < schema.byteCount; position++) {
      if (bytes[position] !== null) continue;
      for (let candidate = 0; candidate <= 255; candidate++) {
        const correct = await guessOne(position, candidate);
        if (correct) break;
      }
    }
    setAutoRunning(false);
  };

  return (
    <div className="widget widget-byte-guesser">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>

      <div className="byte-guesser-grid">
        {Array.from({ length: schema.byteCount }, (_, position) => (
          <div key={position} className="byte-guesser-row">
            <span className="byte-guesser-index">byte[{position}]</span>
            {bytes[position] !== null ? (
              <span className="byte-guesser-solved">
                0x{bytes[position]!.toString(16).padStart(2, "0")}
              </span>
            ) : (
              <>
                <input
                  type="number"
                  min={0}
                  max={255}
                  className="byte-guesser-input"
                  value={inputs[position]}
                  disabled={busyPosition !== null || autoRunning}
                  onChange={(e) =>
                    setInputs((prev) => {
                      const next = [...prev];
                      next[position] = e.target.value;
                      return next;
                    })
                  }
                />
                <button
                  type="button"
                  className="byte-guesser-guess-btn"
                  disabled={
                    busyPosition !== null ||
                    autoRunning ||
                    inputs[position] === ""
                  }
                  onClick={() => handleManualGuess(position)}
                >
                  {busyPosition === position ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    "猜這個 byte"
                  )}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="widget-secondary-btn"
        disabled={autoRunning || busyPosition !== null || allGuessed}
        onClick={() => void handleAutoSolve()}
      >
        <Zap size={16} />
        {autoRunning ? "自動跑中…" : "自動跑完剩下的"}
      </button>

      {history.length > 0 && (
        <div className="byte-guesser-history">
          <h3>猜過的紀錄</h3>
          <ul>
            {history.slice(-8).map((record, i) => (
              <li key={i} data-correct={record.correct}>
                byte[{record.position}] = 0x
                {record.value.toString(16).padStart(2, "0")}{" "}
                {record.correct ? "存活" : "崩潰"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="widget-primary-btn"
        disabled={!allGuessed}
        onClick={() => onPass(bytes)}
      >
        <Check size={16} />
        Submit
      </button>
    </div>
  );
};
