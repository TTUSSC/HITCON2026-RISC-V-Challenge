// Small rotating status line shown underneath the widget while
// LevelPlayer.tsx's submitState === 'running' — narrates the real emulator
// pipeline stages (see emulatorAdapter.ts's `run()` and loadEmulator.ts's
// header comment) instead of a generic "loading" spinner:
//   1. 組譯中…      — the widget already assembled the ELF bytes before
//                     calling onPass (see assembler/index.ts); this phrase
//                     covers that beat, which by the time this component
//                     mounts has technically just finished, but is still the
//                     honest first step of "what just happened / is about to
//                     resolve".
//   2. 載入模擬器…   — only shown when isEmulatorReady() is false at mount,
//                     i.e. genuinely the first run() call this session,
//                     which is fetching + instantiating the 7.1MB WASM
//                     binary (loadEmulator.ts). Skipped on every later run,
//                     when the module is already cached and this step is
//                     really just an awaited already-resolved promise.
//   3. 執行中…       — mod.run_user() actually executing the assembled
//                     program inside the emulator.
//   4. 驗證結果…     — judge() comparing the EmulatorResult against the
//                     step's expected outcome.
// A run is normally well under a second (the first-ever load is the
// exception), so this is a fixed-interval crossfade through the array, not
// something wired to the real async boundaries — the point is honest
// *ordering*, not frame-accurate sync. See RunStatusTicker.css.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { isEmulatorReady } from "../engine/loadEmulator";
import "./RunStatusTicker.css";

const PHRASE_INTERVAL_MS = 750;

const PHRASES_FIRST_RUN = ["組譯中…", "載入模擬器…", "執行中…", "驗證結果…"];
const PHRASES_CACHED = ["組譯中…", "執行中…", "驗證結果…"];

export function RunStatusTicker() {
  const prefersReducedMotion = useReducedMotion();
  // Captured once at mount (this component only exists while a run is in
  // flight) so the phrase set reflects whether THIS run had to load the
  // WASM module, not whatever isEmulatorReady() happens to say later.
  const [phrases] = useState(() =>
    isEmulatorReady() ? PHRASES_CACHED : PHRASES_FIRST_RUN,
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phrases, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <div className="run-status-ticker">處理中…</div>;
  }

  return (
    <div className="run-status-ticker" role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.span
          key={phrases[index]}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.2 }}
        >
          {phrases[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
