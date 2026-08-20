// Wraps the verified rv32emu WASM call sequence behind a typed run().
// Nothing outside this file should touch `window.Module` directly.
//
// Call sequence + gotchas (verified experimentally, see
// project_hitcon_booth_challenge_design memory for the original trace):
//   1. wait for Module.onRuntimeInitialized
//   2. Module.FS.writeFile(path, bytes) to load the ELF (and any files the
//      program needs, e.g. flag.txt, before running it)
//   3. Module.stdin = () => queue.shift() ?? null
//   4. Module['run_user'](path)
//   5. run_user()'s return value is NOT the real exit code — execution is
//      proxied to a pthread worker. Must poll _indirect_rv_alive() until it
//      goes false (or use Module.onExit) to know it's actually done.
//
// TODO: the actual rv32emu.wasm/.js/.worker.js + coi-serviceworker.min.js
// assets still need to be copied from the verification scratchpad into
// frontend/public/ — this adapter assumes they're loaded via a <script>
// tag that populates window.Module before run() is ever called.

import type { EmulatorResult } from "./types";

interface RV32EmuModule {
  onRuntimeInitialized?: () => void;
  FS: { writeFile: (path: string, data: Uint8Array | string) => void };
  stdin: (() => number | null) | null;
  run_user: (path: string) => void;
  _indirect_rv_alive: () => boolean;
  onExit?: (status: number) => void;
}

declare global {
  interface Window {
    Module?: RV32EmuModule;
  }
}

export interface RunRequest {
  elf: Uint8Array;
  elfPath?: string;
  stdin?: Uint8Array;
  files?: Array<{ path: string; data: Uint8Array }>;
}

function waitForRuntime(mod: RV32EmuModule): Promise<void> {
  return new Promise((resolve) => {
    // Emscripten only fires onRuntimeInitialized once; if it already ran
    // before we attached, FS is already usable.
    if (mod.FS) {
      resolve();
      return;
    }
    mod.onRuntimeInitialized = () => resolve();
  });
}

function pollUntilExited(mod: RV32EmuModule): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!mod._indirect_rv_alive()) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function run(request: RunRequest): Promise<EmulatorResult> {
  const mod = window.Module;
  if (!mod) {
    throw new Error("rv32emu Module not loaded — is rv32emu.js on the page?");
  }

  await waitForRuntime(mod);

  const elfPath = request.elfPath ?? "/challenge.elf";
  mod.FS.writeFile(elfPath, request.elf);
  for (const file of request.files ?? []) {
    mod.FS.writeFile(file.path, file.data);
  }

  let stdoutBuf = "";
  const stdinQueue = request.stdin ? Array.from(request.stdin) : [];
  mod.stdin = () => stdinQueue.shift() ?? null;

  // rv32emu's demo build streams stdout through the EM_ASM-wired DOM/console
  // path rather than a plain callback — capturing it cleanly is still open,
  // see docs/design/platform-architecture.md "待驗證 / 待辦". Placeholder
  // hook below so callers have a stable shape to code against meanwhile.
  const captureStdout = (chunk: string) => {
    stdoutBuf += chunk;
  };
  void captureStdout;

  mod.run_user(elfPath);
  await pollUntilExited(mod);

  return {
    exitCode: 0, // TODO: wire real exit code once onExit capture is confirmed
    stdout: stdoutBuf,
    registers: {},
  };
}
