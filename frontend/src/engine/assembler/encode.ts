// Bit-level RV32I instruction encoders. Each function returns the 32-bit
// instruction word as an unsigned integer (caller writes it little-endian).

function u(bits: number, width: number): number {
  const mask = width >= 32 ? 0xffffffff : (1 << width) - 1;
  return bits & mask;
}

export function encodeR(
  opcode: number,
  rd: number,
  funct3: number,
  rs1: number,
  rs2: number,
  funct7: number,
): number {
  return (
    (u(funct7, 7) << 25) |
    (u(rs2, 5) << 20) |
    (u(rs1, 5) << 15) |
    (u(funct3, 3) << 12) |
    (u(rd, 5) << 7) |
    u(opcode, 7)
  );
}

export function encodeI(
  opcode: number,
  rd: number,
  funct3: number,
  rs1: number,
  imm: number,
): number {
  return (
    (u(imm, 12) << 20) |
    (u(rs1, 5) << 15) |
    (u(funct3, 3) << 12) |
    (u(rd, 5) << 7) |
    u(opcode, 7)
  );
}

export function encodeS(
  opcode: number,
  funct3: number,
  rs1: number,
  rs2: number,
  imm: number,
): number {
  const immU = u(imm, 12);
  const imm11_5 = (immU >> 5) & 0x7f;
  const imm4_0 = immU & 0x1f;
  return (
    (imm11_5 << 25) |
    (u(rs2, 5) << 20) |
    (u(rs1, 5) << 15) |
    (u(funct3, 3) << 12) |
    (imm4_0 << 7) |
    u(opcode, 7)
  );
}

export function encodeB(
  opcode: number,
  funct3: number,
  rs1: number,
  rs2: number,
  imm: number,
): number {
  // imm is a signed, even byte offset; bit0 is always 0.
  const immU = u(imm, 13);
  const bit12 = (immU >> 12) & 1;
  const bit11 = (immU >> 11) & 1;
  const bits10_5 = (immU >> 5) & 0x3f;
  const bits4_1 = (immU >> 1) & 0xf;
  return (
    (bit12 << 31) |
    (bits10_5 << 25) |
    (u(rs2, 5) << 20) |
    (u(rs1, 5) << 15) |
    (u(funct3, 3) << 12) |
    (bits4_1 << 8) |
    (bit11 << 7) |
    u(opcode, 7)
  );
}

export function encodeU(opcode: number, rd: number, imm20: number): number {
  return (u(imm20, 20) << 12) | (u(rd, 5) << 7) | u(opcode, 7);
}

export function encodeJ(opcode: number, rd: number, imm: number): number {
  const immU = u(imm, 21);
  const bit20 = (immU >> 20) & 1;
  const bits10_1 = (immU >> 1) & 0x3ff;
  const bit11 = (immU >> 11) & 1;
  const bits19_12 = (immU >> 12) & 0xff;
  return (
    (bit20 << 31) |
    (bits10_1 << 21) |
    (bit11 << 20) |
    (bits19_12 << 12) |
    (u(rd, 5) << 7) |
    u(opcode, 7)
  );
}
