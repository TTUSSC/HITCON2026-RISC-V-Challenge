// Wraps the verified rv32emu WASM call sequence behind a typed run().
// Nothing outside this file should touch `window.Module` directly — use
// `loadEmulator()` (loadEmulator.ts) for that.
//
// Call sequence + gotchas (verified experimentally against the real WASM
// build, see project_hitcon_booth_challenge_design memory + loadEmulator.ts
// header comment for the cross-origin-isolation requirement):
//   1. loadEmulator() — resolves once Module.onRuntimeInitialized has fired.
//   2. Module.FS.writeFile(path, bytes) to load the ELF (and any files the
//      program needs, e.g. flag.txt, before running it).
//   3. Module.stdin = () => queue.shift() ?? null
//   4. Register a stdout sink + exit listener (see loadEmulator.ts), then
//      call Module['run_user'](path).
//   5. run_user()'s return value is NOT the real exit code — execution is
//      proxied to a pthread worker. Module.onExit(status) fires the real
//      exit code; _indirect_rv_alive() polling is kept only as a fallback
//      for the (empirically rare) case onExit doesn't fire.

import type { EmulatorResult } from "./types";
import { loadEmulator, setExitListener, setStdoutSink } from "./loadEmulator";

export interface RunRequest {
  elf: Uint8Array;
  elfPath?: string;
  stdin?: Uint8Array;
  files?: Array<{ path: string; data: Uint8Array }>;
}

// Safety net in case neither onExit nor the alive-poll ever resolve (e.g. a
// hung/looping program). Keeps a single bad ELF from wedging the judge UI.
const RUN_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 50;

export async function run(request: RunRequest): Promise<EmulatorResult> {
  const mod = await loadEmulator();

  const elfPath = request.elfPath ?? "/challenge.elf";
  mod.FS.writeFile(elfPath, request.elf);
  for (const file of request.files ?? []) {
    mod.FS.writeFile(file.path, file.data);
  }

  const stdinQueue = request.stdin ? Array.from(request.stdin) : [];
  mod.stdin = () => stdinQueue.shift() ?? null;

  const stdoutLines: string[] = [];
  setStdoutSink((line) => stdoutLines.push(line));

  let exitCode: number;
  try {
    exitCode = await new Promise<number>((resolve) => {
      let settled = false;
      const settle = (status: number) => {
        if (settled) return;
        settled = true;
        resolve(status);
      };

      setExitListener(settle);
      mod.run_user(elfPath);

      const deadline = Date.now() + RUN_TIMEOUT_MS;
      const poll = () => {
        if (settled) return;
        if (
          typeof mod._indirect_rv_alive === "function" &&
          !mod._indirect_rv_alive()
        ) {
          // onExit didn't fire but the program is confirmed dead — exit
          // code is unrecoverable at this point, treat as clean (0).
          settle(0);
          return;
        }
        if (Date.now() > deadline) {
          settle(-1); // sentinel: run timed out, did not observe exit
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      };
      setTimeout(poll, POLL_INTERVAL_MS);
    });
  } finally {
    setExitListener(null);
    setStdoutSink(null);
  }

  return {
    exitCode,
    stdout: stdoutLines.join("\n"),
    registers: {},
  };
}
