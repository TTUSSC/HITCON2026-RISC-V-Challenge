// Loads the rv32emu Emscripten build (`/rv32emu.js` + `/rv32emu.wasm` +
// `/rv32emu.worker.js`, copied verbatim into `public/` from the verified
// demo build — see docs/design/platform-architecture.md 判題引擎) onto the
// page and hands back the resulting `window.Module` once its runtime is
// actually usable.
//
// `rv32emu.js` is Emscripten glue, not an ES module — it expects a global
// `Module` object to already exist (it does `var Module = typeof Module !=
// "undefined" ? Module : {}`) and it registers itself onto `window`. So this
// loader pre-seeds `window.Module` with the hooks we need, then injects the
// script via a plain <script src> tag rather than importing it — bundling it
// through Vite would fight its `document.currentScript`-based asset
// resolution (it uses that to build the absolute URL for rv32emu.wasm /
// rv32emu.worker.js).
//
// IMPORTANT — cross-origin isolation: this build uses SharedArrayBuffer for
// its pthread worker, which requires `crossOriginIsolated === true`. That
// only happens when the page is served with
//   Cross-Origin-Opener-Policy: same-origin
//   Cross-Origin-Embedder-Policy: require-corp
// `vite.config.ts` sets these for `vite dev` / `vite preview`. Whatever
// static host serves the production build at the actual booth MUST also set
// these two response headers, or the WASM module will fail to instantiate.
//
// Stdout capture: rv32emu's `Module.print` is Emscripten's per-line stdout
// callback (called once per completed line, no trailing newline). We
// override it here with a single long-lived callback that forwards to
// whatever "sink" the current run() call has registered via
// `setStdoutSink`, instead of the demo's original behaviour of writing to a
// DOM terminal / console.log.

import type { EmulatorResult } from "./types";

export interface RV32EmuModule {
  FS: {
    writeFile: (path: string, data: Uint8Array | string) => void;
  };
  stdin: (() => number | null) | null;
  run_user: (path: string) => number;
  _indirect_rv_alive: () => boolean;
  onExit?: (status: number) => void;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  onRuntimeInitialized?: () => void;
  noInitialRun?: boolean;
  canvas?: HTMLCanvasElement;
}

declare global {
  interface Window {
    Module?: RV32EmuModule;
  }
}

const EMULATOR_SCRIPT_SRC = "/rv32emu.js";

// The rv32emu.wasm binary itself (not just the demo's index.html) imports a
// handful of JS glue functions — `enable_run_button` / `disable_run_button`
// / `report_run_completion` (rv32emu.js ~L18144) — that unconditionally do
// `document.getElementById(id).disabled = ...` / `.classList...` with no
// null-guard on some of them. Those ids come from the demo UI this build was
// authored against, not anything the emulator logic actually needs — but
// without matching DOM nodes present, run_user() throws a TypeError the
// instant the program starts running. We stub them out as detached, hidden
// elements rather than patching the vendored rv32emu.js.
const STUB_ELEMENT_IDS = [
  "runButton",
  "stopButton",
  "statusText",
  "statusBadge",
] as const;

function ensureStubDomElements(): void {
  for (const id of STUB_ELEMENT_IDS) {
    if (document.getElementById(id)) continue;
    const el = document.createElement(
      id === "runButton" || id === "stopButton" ? "button" : "span",
    );
    el.id = id;
    el.hidden = true;
    document.body.appendChild(el);
  }
  if (!document.getElementById("canvas")) {
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.hidden = true;
    document.body.appendChild(canvas);
  }
}

type PrintSink = (line: string) => void;
type ExitListener = (status: number) => void;

let currentStdoutSink: PrintSink | null = null;
let currentExitListener: ExitListener | null = null;
let modulePromise: Promise<RV32EmuModule> | null = null;

export function setStdoutSink(sink: PrintSink | null): void {
  currentStdoutSink = sink;
}

export function setExitListener(listener: ExitListener | null): void {
  currentExitListener = listener;
}

/** Loads rv32emu.js (once) and resolves once its runtime is ready to run
 * ELFs — i.e. after `onRuntimeInitialized`, mirroring the way the reference
 * demo flips its own "Ready" status. Safe to call repeatedly; subsequent
 * calls return the same in-flight/resolved promise. */
export function loadEmulator(): Promise<RV32EmuModule> {
  if (modulePromise) return modulePromise;

  modulePromise = new Promise<RV32EmuModule>((resolve, reject) => {
    ensureStubDomElements();
    const seed: RV32EmuModule = {
      // rv32emu.js itself hardcodes this to true, but seed it too for
      // clarity: we always call run_user() explicitly, never rely on an
      // implicit "run main()" on load.
      noInitialRun: true,
      FS: undefined as unknown as RV32EmuModule["FS"],
      stdin: null,
      run_user: undefined as unknown as RV32EmuModule["run_user"],
      _indirect_rv_alive:
        undefined as unknown as RV32EmuModule["_indirect_rv_alive"],
      print: (text: string) => currentStdoutSink?.(text),
      printErr: (text: string) => currentStdoutSink?.(`[stderr] ${text}`),
      onExit: (status: number) => currentExitListener?.(status),
      onRuntimeInitialized: () => resolve(window.Module as RV32EmuModule),
      canvas: document.getElementById("canvas") as HTMLCanvasElement,
    };
    window.Module = seed;

    const script = document.createElement("script");
    script.src = EMULATOR_SCRIPT_SRC;
    script.async = true;
    script.onerror = () =>
      reject(new Error(`failed to load ${EMULATOR_SCRIPT_SRC}`));
    document.body.appendChild(script);
  });

  return modulePromise;
}

// Re-exported so callers that only need the result shape don't have to know
// about the Module internals.
export type { EmulatorResult };
