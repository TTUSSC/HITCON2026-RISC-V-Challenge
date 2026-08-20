// Minimal two-pass RV32I(+ecall) assembler for the instruction subset taught
// in docs/design/levels.md. Not a general-purpose assembler: no macros, no
// relocations, no compressed (RVC) encoding, no expressions beyond a single
// integer literal or label reference. That's deliberate — this only needs to
// assemble curriculum snippets and freehand-editor user input, not arbitrary
// real-world asm.
//
// Design: pass 1 walks every line, assigning each instruction/directive an
// address (starting at BASE_ADDRESS, mirroring orw_fixed.elf's .text origin
// verified against the real rv32emu loader) and recording label addresses.
// Pass 2 re-walks the same lines and encodes each into bytes, now able to
// resolve label references (branches/jal use pc-relative offsets; `la`
// resolves to an absolute address via lui+addi).
//
// Pseudo-instructions supported: li, la, mv, nop, ret (see levels.md's L0-2
// "li／mv 其實是假指令" — these are exactly the ones the curriculum calls
// out). li expands to a single addi when the immediate fits 12 signed bits,
// otherwise lui+addi; la always expands to lui+addi (addresses are rarely
// 12-bit-representable, and always assuming 2 words keeps pass-1 address
// bookkeeping unambiguous — see file header).

import { encodeB, encodeI, encodeJ, encodeR, encodeS, encodeU } from "./encode";
import { resolveRegister } from "./registers";

export const BASE_ADDRESS = 0x10000;

export interface AssembleError {
  line: number;
  message: string;
}

export interface AssembleSuccess {
  ok: true;
  bytes: Uint8Array;
  baseAddress: number;
  /** Where execution should start: the `_start` label's address if one was
   * defined, otherwise baseAddress (the first byte emitted). Needed because
   * a program may (and often does, e.g. `.data` before `.text`) place
   * non-code bytes before its entry code. */
  entry: number;
  /** Resolved label -> address map, exposed for tests/tools that want it. */
  labels: Record<string, number>;
}

export interface AssembleFailure {
  ok: false;
  errors: AssembleError[];
}

export type AssembleResult = AssembleSuccess | AssembleFailure;

interface RawLine {
  line: number;
  label?: string;
  mnemonic?: string;
  operands: string[];
}

function stripComment(line: string): string {
  const i = line.indexOf("#");
  return i === -1 ? line : line.slice(0, i);
}

function splitOperands(rest: string): string[] {
  return rest
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseLines(source: string): {
  lines: RawLine[];
  errors: AssembleError[];
} {
  const lines: RawLine[] = [];
  const errors: AssembleError[] = [];
  const rawLines = source.split(/\r?\n/);

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    let text = stripComment(rawLines[i]).trim();
    if (text.length === 0) continue;

    let label: string | undefined;
    const labelMatch = /^([A-Za-z_.][A-Za-z0-9_.]*)\s*:\s*(.*)$/.exec(text);
    if (labelMatch) {
      label = labelMatch[1];
      text = labelMatch[2].trim();
    }

    if (text.length === 0) {
      if (label) lines.push({ line: lineNumber, label, operands: [] });
      continue;
    }

    const spaceIdx = text.search(/\s/);
    const mnemonic = (
      spaceIdx === -1 ? text : text.slice(0, spaceIdx)
    ).toLowerCase();
    const rest = spaceIdx === -1 ? "" : text.slice(spaceIdx + 1).trim();
    const operands = splitOperands(rest);
    lines.push({ line: lineNumber, label, mnemonic, operands });
  }

  return { lines, errors };
}

// Parses a decimal or 0x-hex integer literal (optionally signed).
function parseIntLiteral(tok: string): number | undefined {
  const m = /^-?(0[xX][0-9a-fA-F]+|\d+)$/.exec(tok);
  if (!m) return undefined;
  return Number(tok);
}

function reg(tok: string, line: number, errors: AssembleError[]): number {
  const r = resolveRegister(tok);
  if (r === undefined) {
    errors.push({ line, message: `unknown register "${tok}"` });
    return 0;
  }
  return r;
}

// Directive/instruction sizes (bytes) needed for pass-1 address bookkeeping.
function sizeOfDirective(mnemonic: string, operands: string[]): number {
  switch (mnemonic) {
    case ".word":
      return 4 * Math.max(operands.length, 1);
    case ".byte":
      return Math.max(operands.length, 1);
    case ".asciz":
    case ".string": {
      const s = parseStringLiteral(operands.join(","));
      return (s?.length ?? 0) + 1;
    }
    case ".ascii": {
      const s = parseStringLiteral(operands.join(","));
      return s?.length ?? 0;
    }
    case ".space": {
      const n = parseIntLiteral(operands[0] ?? "");
      return n ?? 0;
    }
    default:
      return 0;
  }
}

function parseStringLiteral(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (
    trimmed.length < 2 ||
    trimmed[0] !== '"' ||
    trimmed[trimmed.length - 1] !== '"'
  ) {
    return undefined;
  }
  const inner = trimmed.slice(1, -1);
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\0/g, "\0")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

const DIRECTIVES = new Set([
  ".word",
  ".byte",
  ".asciz",
  ".string",
  ".ascii",
  ".space",
  ".text",
  ".data",
  ".global",
  ".globl",
  ".align",
  ".section",
]);

function fitsSigned(value: number, bits: number): boolean {
  const min = -(2 ** (bits - 1));
  const max = 2 ** (bits - 1) - 1;
  return value >= min && value <= max;
}

// Instruction word-count for pass-1 sizing. `li` depends on the literal
// magnitude (known at this point since it must be a numeric literal, not a
// label — see file header); everything else has a fixed size.
function instructionWordCount(mnemonic: string, operands: string[]): number {
  switch (mnemonic) {
    case "li": {
      const imm = parseIntLiteral(operands[1] ?? "");
      if (imm !== undefined && fitsSigned(imm, 12)) return 1;
      return 2;
    }
    case "la":
      return 2;
    default:
      return 1;
  }
}

function alignUp4(addr: number): number {
  return (addr + 3) & ~3;
}

export function assemble(source: string): AssembleResult {
  const { lines, errors: parseErrors } = parseLines(source);
  const errors: AssembleError[] = [...parseErrors];
  const labels: Record<string, number> = {};

  // ---- Pass 1: addresses ----
  // Instructions are always word-aligned (4 bytes), even though data
  // directives (.byte/.asciz/...) can leave `addr` unaligned — e.g. an
  // 8-byte-plus-nul-terminator string ends at an odd offset. A label
  // attached to a bare line (no mnemonic on the same line, e.g. "_start:"
  // on its own) is only resolved once we reach the next actual content, so
  // it gets that content's (possibly aligned) address, not the pre-align one.
  let addr = BASE_ADDRESS;
  let pendingLabels: string[] = [];
  for (const line of lines) {
    if (line.label) pendingLabels.push(line.label);
    if (!line.mnemonic) continue;

    const isInstruction = !DIRECTIVES.has(line.mnemonic);
    if (isInstruction) addr = alignUp4(addr);

    for (const lbl of pendingLabels) {
      if (labels[lbl] !== undefined) {
        errors.push({ line: line.line, message: `duplicate label "${lbl}"` });
      }
      labels[lbl] = addr;
    }
    pendingLabels = [];

    addr += isInstruction
      ? 4 * instructionWordCount(line.mnemonic, line.operands)
      : sizeOfDirective(line.mnemonic, line.operands);
  }
  for (const lbl of pendingLabels) labels[lbl] = addr;

  if (errors.length > 0) return { ok: false, errors };

  // ---- Pass 2: encode ----
  const totalSize = addr - BASE_ADDRESS;
  const bytes = new Uint8Array(totalSize);
  let pc = BASE_ADDRESS;

  const writeWord = (word: number) => {
    const off = pc - BASE_ADDRESS;
    bytes[off] = word & 0xff;
    bytes[off + 1] = (word >>> 8) & 0xff;
    bytes[off + 2] = (word >>> 16) & 0xff;
    bytes[off + 3] = (word >>> 24) & 0xff;
    pc += 4;
  };

  const resolveImmOrLabel = (tok: string, line: number): number | undefined => {
    const lit = parseIntLiteral(tok);
    if (lit !== undefined) return lit;
    if (labels[tok] !== undefined) return labels[tok];
    errors.push({ line, message: `undefined label or bad immediate "${tok}"` });
    return undefined;
  };

  // "offset(reg)" memory operand, e.g. "0(a1)" or "4(sp)".
  const parseMemOperand = (
    tok: string,
    line: number,
  ): { offset: number; base: number } | undefined => {
    const m = /^(-?(?:0[xX][0-9a-fA-F]+|\d+))\((\w+)\)$/.exec(tok);
    if (!m) {
      errors.push({
        line,
        message: `expected "offset(reg)" operand, got "${tok}"`,
      });
      return undefined;
    }
    const offset = Number(m[1]);
    const base = reg(m[2], line, errors);
    return { offset, base };
  };

  const expectOperands = (line: RawLine, count: number): boolean => {
    if (line.operands.length !== count) {
      errors.push({
        line: line.line,
        message: `"${line.mnemonic}" expects ${count} operand(s), got ${line.operands.length}`,
      });
      return false;
    }
    return true;
  };

  for (const line of lines) {
    const m = line.mnemonic;
    if (!m) continue;
    const ops = line.operands;
    const ln = line.line;

    // Mirror pass 1's word-alignment: pad with zero bytes so instructions
    // always start on a 4-byte boundary, even after odd-length string data.
    if (!DIRECTIVES.has(m)) {
      while (pc % 4 !== 0) {
        bytes[pc - BASE_ADDRESS] = 0;
        pc += 1;
      }
    }

    switch (m) {
      // ---- directives ----
      case ".text":
      case ".data":
      case ".global":
      case ".globl":
      case ".align":
      case ".section":
        continue;
      case ".word": {
        for (const tok of ops) {
          const v = resolveImmOrLabel(tok, ln) ?? 0;
          const off = pc - BASE_ADDRESS;
          bytes[off] = v & 0xff;
          bytes[off + 1] = (v >>> 8) & 0xff;
          bytes[off + 2] = (v >>> 16) & 0xff;
          bytes[off + 3] = (v >>> 24) & 0xff;
          pc += 4;
        }
        continue;
      }
      case ".byte": {
        for (const tok of ops) {
          const v = parseIntLiteral(tok);
          if (v === undefined) {
            errors.push({ line: ln, message: `bad .byte literal "${tok}"` });
            continue;
          }
          bytes[pc - BASE_ADDRESS] = v & 0xff;
          pc += 1;
        }
        continue;
      }
      case ".asciz":
      case ".string":
      case ".ascii": {
        const s = parseStringLiteral(ops.join(","));
        if (s === undefined) {
          errors.push({ line: ln, message: `bad string literal in "${m}"` });
          continue;
        }
        for (let i = 0; i < s.length; i++) {
          bytes[pc - BASE_ADDRESS] = s.charCodeAt(i) & 0xff;
          pc += 1;
        }
        if (m === ".asciz" || m === ".string") {
          bytes[pc - BASE_ADDRESS] = 0;
          pc += 1;
        }
        continue;
      }
      case ".space": {
        const n = parseIntLiteral(ops[0] ?? "") ?? 0;
        pc += n; // already zero-initialized (Uint8Array default)
        continue;
      }

      // ---- pseudo-instructions ----
      case "nop":
        writeWord(encodeI(0x13, 0, 0, 0, 0)); // addi x0, x0, 0
        continue;
      case "ret":
        writeWord(encodeI(0x67, 0, 0, 1, 0)); // jalr x0, ra, 0
        continue;
      case "mv": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const rs = reg(ops[1], ln, errors);
        writeWord(encodeI(0x13, rd, 0, rs, 0)); // addi rd, rs, 0
        continue;
      }
      case "li": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const imm = resolveImmOrLabel(ops[1], ln);
        if (imm === undefined) continue;
        if (fitsSigned(imm, 12)) {
          writeWord(encodeI(0x13, rd, 0, 0, imm));
        } else {
          const upper = (imm + 0x800) >> 12;
          const lower = imm - (upper << 12);
          writeWord(encodeU(0x37, rd, upper)); // lui rd, upper
          writeWord(encodeI(0x13, rd, 0, rd, lower)); // addi rd, rd, lower
        }
        continue;
      }
      case "la": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const addrVal = resolveImmOrLabel(ops[1], ln);
        if (addrVal === undefined) continue;
        const upper = (addrVal + 0x800) >> 12;
        const lower = addrVal - (upper << 12);
        writeWord(encodeU(0x37, rd, upper)); // lui rd, upper
        writeWord(encodeI(0x13, rd, 0, rd, lower)); // addi rd, rd, lower
        continue;
      }

      // ---- real instructions ----
      case "add": {
        if (!expectOperands(line, 3)) continue;
        writeWord(
          encodeR(
            0x33,
            reg(ops[0], ln, errors),
            0,
            reg(ops[1], ln, errors),
            reg(ops[2], ln, errors),
            0x00,
          ),
        );
        continue;
      }
      case "sub": {
        if (!expectOperands(line, 3)) continue;
        writeWord(
          encodeR(
            0x33,
            reg(ops[0], ln, errors),
            0,
            reg(ops[1], ln, errors),
            reg(ops[2], ln, errors),
            0x20,
          ),
        );
        continue;
      }
      case "addi": {
        if (!expectOperands(line, 3)) continue;
        const rd = reg(ops[0], ln, errors);
        const rs1 = reg(ops[1], ln, errors);
        const imm = resolveImmOrLabel(ops[2], ln) ?? 0;
        writeWord(encodeI(0x13, rd, 0, rs1, imm));
        continue;
      }
      case "lui": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const imm = resolveImmOrLabel(ops[1], ln) ?? 0;
        writeWord(encodeU(0x37, rd, imm));
        continue;
      }
      case "auipc": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const imm = resolveImmOrLabel(ops[1], ln) ?? 0;
        writeWord(encodeU(0x17, rd, imm));
        continue;
      }
      case "lw": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const mem = parseMemOperand(ops[1], ln);
        if (!mem) continue;
        writeWord(encodeI(0x03, rd, 2, mem.base, mem.offset));
        continue;
      }
      case "sw": {
        if (!expectOperands(line, 2)) continue;
        const rs2 = reg(ops[0], ln, errors);
        const mem = parseMemOperand(ops[1], ln);
        if (!mem) continue;
        writeWord(encodeS(0x23, 2, mem.base, rs2, mem.offset));
        continue;
      }
      // lb/sb (byte load/store) aren't in the curriculum's taught mnemonic
      // list, but are needed internally to build the register-value-to-
      // stdout print harness (see engine/registerProbe.ts) — kept minimal
      // (no lbu/lh/lhu/sh) since that's the only consumer.
      case "lb": {
        if (!expectOperands(line, 2)) continue;
        const rd = reg(ops[0], ln, errors);
        const mem = parseMemOperand(ops[1], ln);
        if (!mem) continue;
        writeWord(encodeI(0x03, rd, 0, mem.base, mem.offset));
        continue;
      }
      case "sb": {
        if (!expectOperands(line, 2)) continue;
        const rs2 = reg(ops[0], ln, errors);
        const mem = parseMemOperand(ops[1], ln);
        if (!mem) continue;
        writeWord(encodeS(0x23, 0, mem.base, rs2, mem.offset));
        continue;
      }
      case "beq":
      case "bne":
      case "blt":
      case "bge": {
        if (!expectOperands(line, 3)) continue;
        const rs1 = reg(ops[0], ln, errors);
        const rs2 = reg(ops[1], ln, errors);
        const target = resolveImmOrLabel(ops[2], ln);
        if (target === undefined) continue;
        const offset = labels[ops[2]] !== undefined ? target - pc : target;
        const funct3 = { beq: 0, bne: 1, blt: 4, bge: 5 }[m]!;
        writeWord(encodeB(0x63, funct3, rs1, rs2, offset));
        continue;
      }
      case "jal": {
        // jal rd, target  OR  jal target (rd defaults to ra)
        let rd: number;
        let targetTok: string;
        if (ops.length === 2) {
          rd = reg(ops[0], ln, errors);
          targetTok = ops[1];
        } else if (ops.length === 1) {
          rd = 1;
          targetTok = ops[0];
        } else {
          errors.push({ line: ln, message: `"jal" expects 1 or 2 operands` });
          continue;
        }
        const target = resolveImmOrLabel(targetTok, ln);
        if (target === undefined) continue;
        const offset = labels[targetTok] !== undefined ? target - pc : target;
        writeWord(encodeJ(0x6f, rd, offset));
        continue;
      }
      case "jalr": {
        if (!expectOperands(line, 3)) continue;
        const rd = reg(ops[0], ln, errors);
        const rs1 = reg(ops[1], ln, errors);
        const imm = resolveImmOrLabel(ops[2], ln) ?? 0;
        writeWord(encodeI(0x67, rd, 0, rs1, imm));
        continue;
      }
      case "ecall":
        writeWord(0x00000073);
        continue;

      default:
        errors.push({ line: ln, message: `unknown instruction "${m}"` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const entry = labels["_start"] ?? BASE_ADDRESS;
  return { ok: true, bytes, baseAddress: BASE_ADDRESS, entry, labels };
}
