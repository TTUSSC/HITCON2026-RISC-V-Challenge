// Builds a self-contained test program that runs some setup/instruction-
// under-test assembly and then reports one register's final value back out
// as a "reg=value" line on stdout.
//
// Why this exists (see the L0 register-read design note in judge.ts/
// LevelPlayer.tsx): the vendored rv32emu WASM build exports no
// register-accessor function — grepping rv32emu.js and the rv32emu C sources
// (src/main.c / em_runtime.h) for EMSCRIPTEN_KEEPALIVE exports turns up only
// indirect_rv_alive/halt/cleanup/stop_requested, nothing that reads CPU
// state. Rebuilding rv32emu's Emscripten build to add such an export is out
// of scope (no local RISC-V/Emscripten toolchain in this environment) — so
// instead the assembled *guest* program converts its own target register to
// a decimal string and writes it to stdout via the write syscall (a7=64),
// same as any other guest program would.
//
// Verified end-to-end against the real WASM build: rv32emu's write syscall
// (src/syscall.c: syscall_write) fwrite()s straight to the fd-mapped stdout
// FILE*, and Module.print (rv32emu.js's per-line stdout callback) only fires
// once a line is complete — a write() with no trailing "\n" is silently
// dropped from `EmulatorResult.stdout`. So the harness always ends its
// output with "\n", and `emulatorAdapter.run()` parses trailing "name=value"
// stdout lines into `EmulatorResult.registers`, giving callers a
// `result.registers["a0"]`-shaped read exactly as if a real register read
// had happened.
//
// The decimal-conversion loop only has add/addi/sub/branches/lb/sb available
// (no RV32M divide), so it computes value/10 and value%10 by repeated
// subtraction each digit — fine for the tiny (single/low-double-digit)
// register values this curriculum ever checks.

export function buildRegisterProbeProgram(
  setupAsm: string,
  targetRegister: string,
  // Extra `.data`-style lines (labels + .word/.byte/.asciz/.space) the
  // setup asm references, e.g. L0-3's known memory values for lw to load
  // from. Must be data only, no instructions — it's appended after the
  // probe's own trailing code, so anything placed here is never executed,
  // only ever addressed via `la`/`lw`/`sw` from setupAsm.
  extraData = "",
): string {
  return `
.text
_start:
${setupAsm}
    mv   t0, ${targetRegister}
    la   t2, __probe_digbuf
    addi t2, t2, 15
    li   t3, 0
    li   t6, 10

    bne  t0, x0, __probe_loop
    addi t2, t2, -1
    li   t4, 48
    sb   t4, 0(t2)
    addi t3, t3, 1
    jal  x0, __probe_done

__probe_loop:
    beq  t0, x0, __probe_done
    li   t4, 0
    mv   t5, t0
__probe_digit_div:
    blt  t5, t6, __probe_digit_div_done
    sub  t5, t5, t6
    addi t4, t4, 1
    jal  x0, __probe_digit_div
__probe_digit_div_done:
    addi t5, t5, 48
    addi t2, t2, -1
    sb   t5, 0(t2)
    addi t3, t3, 1
    mv   t0, t4
    jal  x0, __probe_loop

__probe_done:
    # write "<targetRegister>=" prefix first (stays buffered, no newline yet)
    la   a1, __probe_prefix
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
    ecall
    li   a0, 0
    li   a7, 93
    ecall
.data
__probe_prefix: .ascii "${targetRegister}="
__probe_digbuf: .space 20
${extraData}
`;
}
