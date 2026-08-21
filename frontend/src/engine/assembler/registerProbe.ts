// Builds a self-contained test program that runs some setup/instruction-
// under-test assembly and then reports one or more registers' final values
// back out as "reg=value" lines on stdout.
//
// Why this exists (see the L0 register-read design note in judge.ts/
// LevelPlayer.tsx): the vendored rv32emu WASM build exports no
// register-accessor function — grepping rv32emu.js and the rv32emu C sources
// (src/main.c / em_runtime.h) for EMSCRIPTEN_KEEPALIVE exports turns up only
// indirect_rv_alive/halt/cleanup/stop_requested, nothing that reads CPU
// state. Rebuilding rv32emu's Emscripten build to add such an export is out
// of scope (no local RISC-V/Emscripten toolchain in this environment) — so
// instead the assembled *guest* program converts its own target register(s)
// to decimal strings and writes them to stdout via the write syscall
// (a7=64), same as any other guest program would.
//
// Verified end-to-end against the real WASM build: rv32emu's write syscall
// (src/syscall.c: syscall_write) fwrite()s straight to the fd-mapped stdout
// FILE*, and Module.print (rv32emu.js's per-line stdout callback) only fires
// once a line is complete — a write() with no trailing "\n" is silently
// dropped from `EmulatorResult.stdout`. So the harness always ends each
// register's line with "\n", and `emulatorAdapter.run()` parses every
// trailing "name=value" stdout line into `EmulatorResult.registers` (it
// already loops over all stdout lines, so probing several registers needs
// no change on the parsing side — see emulatorAdapter.ts's
// parseRegisterLines), giving callers a `result.registers["a0"]`-shaped read
// exactly as if a real register read had happened.
//
// The decimal-conversion loop only has add/addi/sub/branches/lb/sb available
// (no RV32M divide), so it computes value/10 and value%10 by repeated
// subtraction each digit — fine for the tiny (single/low-double-digit)
// register values this curriculum ever checks.
//
// Multiple target registers (e.g. L1-1's merged-checkpoint step, which
// checks a0 *and* a1 together): each register gets its own probe block with
// its own uniquely-labeled loop/data symbols (label collisions would
// otherwise be a hard assembler error), run back-to-back after the shared
// setup, each printing its own "reg=value\n" line in the order given. A
// single register still goes through the same path as a one-element list.
//
// Every probe block's own write-syscall body clobbers a0/a1/a2/a7 (it has
// to — those are the real ecall argument registers). That's harmless for a
// single-register probe, but for a multi-register probe where a *later*
// target is itself a0/a1/a2/a7 (the exact case L1's calling-convention
// levels care about), that register would already be corrupted by an
// earlier block's write call by the time its own block tries to read it.
// Fixed by capturing every target's value into a dedicated save register
// (s8upward, chosen because this curriculum's setupAsm content never
// touches s8+ — see levels.ts's existing "mv s1, a0 # 存到 s1，避免被下一個
// syscall 蓋掉" pattern for the same clobber problem solved by hand at the
// content level) *before* any block's write-syscall body runs, so every
// probe block reads its captured copy instead of the live, possibly
// already-clobbered register.

interface ProbeBlock {
  code: string;
  data: string;
}

const SAVE_REGISTERS = [
  "s8",
  "s9",
  "s10",
  "s11",
  "s7",
  "s6",
  "s5",
  "s4",
] as const;

function buildProbeBlock(
  saveRegister: string,
  targetRegister: string,
  index: number,
): ProbeBlock {
  const loop = `__probe_loop_${index}`;
  const done = `__probe_done_${index}`;
  const digitDiv = `__probe_digit_div_${index}`;
  const digitDivDone = `__probe_digit_div_done_${index}`;
  const prefix = `__probe_prefix_${index}`;
  const digbuf = `__probe_digbuf_${index}`;

  const code = `    mv   t0, ${saveRegister}
    la   t2, ${digbuf}
    addi t2, t2, 15
    li   t3, 0
    li   t6, 10

    bne  t0, x0, ${loop}
    addi t2, t2, -1
    li   t4, 48
    sb   t4, 0(t2)
    addi t3, t3, 1
    jal  x0, ${done}

${loop}:
    beq  t0, x0, ${done}
    li   t4, 0
    mv   t5, t0
${digitDiv}:
    blt  t5, t6, ${digitDivDone}
    sub  t5, t5, t6
    addi t4, t4, 1
    jal  x0, ${digitDiv}
${digitDivDone}:
    addi t5, t5, 48
    addi t2, t2, -1
    sb   t5, 0(t2)
    addi t3, t3, 1
    mv   t0, t4
    jal  x0, ${loop}

${done}:
    # write "<targetRegister>=" prefix first (stays buffered, no newline yet)
    la   a1, ${prefix}
    li   a2, ${targetRegister.length + 1}
    li   a0, 1
    li   a7, 64
    ecall
    # then the digits + trailing newline (flushes the whole buffered line)
    add  t5, t2, t3
    li   t4, 10
    sb   t4, 0(t5)
    addi t3, t3, 1
    mv   a1, t2
    mv   a2, t3
    li   a0, 1
    li   a7, 64
    ecall`;

  const data = `${prefix}: .ascii "${targetRegister}="
${digbuf}: .space 20`;

  return { code, data };
}

export function buildRegisterProbeProgram(
  setupAsm: string,
  targetRegisters: string | string[],
  // Extra `.data`-style lines (labels + .word/.byte/.asciz/.space) the
  // setup asm references, e.g. L0-3's known memory values for lw to load
  // from. Must be data only, no instructions — it's appended after the
  // probe's own trailing code, so anything placed here is never executed,
  // only ever addressed via `la`/`lw`/`sw` from setupAsm.
  extraData = "",
): string {
  const targets = Array.isArray(targetRegisters)
    ? targetRegisters
    : [targetRegisters];
  if (targets.length > SAVE_REGISTERS.length) {
    throw new Error(
      `buildRegisterProbeProgram: cannot probe ${targets.length} registers at once (max ${SAVE_REGISTERS.length})`,
    );
  }
  // Capture every target's value into its own save register up front, before
  // any block's write-syscall body has a chance to clobber a0/a1/a2/a7 (see
  // the file comment above).
  const captureLines = targets
    .map((reg, i) => `    mv   ${SAVE_REGISTERS[i]}, ${reg}`)
    .join("\n");
  const blocks = targets.map((reg, i) =>
    buildProbeBlock(SAVE_REGISTERS[i], reg, i),
  );

  return `
.text
_start:
${setupAsm}
${captureLines}
${blocks.map((b) => b.code).join("\n")}
    li   a0, 0
    li   a7, 93
    ecall
.data
${blocks.map((b) => b.data).join("\n")}
${extraData}
`;
}
