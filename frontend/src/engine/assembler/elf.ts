// Minimal RV32 ELF32 executable writer. Format verified against a real,
// WASM-confirmed-working reference file (orw_fixed.elf, built with
// `riscv-none-elf-gcc -march=rv32imac -mabi=ilp32 -mno-relax -nostdlib
// -static -Ttext=0x10000`) — see readelf -h/-l output studied for this task.
//
// rv32emu's loader (src/elf.c: elf_load) only reads e_phnum/e_phoff program
// headers and memcpy's each PT_LOAD's file bytes to its p_vaddr, zero-filling
// the rest of p_memsz. It does NOT require section headers, a symbol table,
// or a string table — those only back optional debug-symbol lookups
// (elf_get_symbol for "_end"/"exit"/"tohost" etc., all null-guarded). So this
// writer emits the smallest valid file: ELF header + one program header +
// raw code/data bytes, all in a single RWX PT_LOAD segment (no separate
// text/data segments — permission-bit enforcement isn't part of what this
// loader checks, and a single segment keeps address bookkeeping simple for
// the assembler above, which freely interleaves instructions and .word/
// .asciz data in one flat address space).

export const ELF_HEADER_SIZE = 52;
export const PROGRAM_HEADER_SIZE = 32;

export function buildElf(
  code: Uint8Array,
  baseAddress: number,
  entry: number = baseAddress,
): Uint8Array {
  const phOffset = ELF_HEADER_SIZE;
  const codeOffset = phOffset + PROGRAM_HEADER_SIZE;
  const totalSize = codeOffset + code.length;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // ---- ELF header ----
  buf[0] = 0x7f;
  buf[1] = 0x45; // 'E'
  buf[2] = 0x4c; // 'L'
  buf[3] = 0x46; // 'F'
  buf[4] = 1; // ELFCLASS32
  buf[5] = 1; // little endian
  buf[6] = 1; // EI_VERSION
  buf[7] = 0; // EI_OSABI (System V)
  // bytes 8..15 (ABI version + padding) stay 0

  view.setUint16(16, 2, true); // e_type = ET_EXEC
  view.setUint16(18, 0xf3, true); // e_machine = EM_RISCV (243)
  view.setUint32(20, 1, true); // e_version
  view.setUint32(24, entry, true); // e_entry
  view.setUint32(28, phOffset, true); // e_phoff
  view.setUint32(32, 0, true); // e_shoff (no section headers)
  view.setUint32(36, 0x1, true); // e_flags (RVC + soft-float, matches reference)
  view.setUint16(40, ELF_HEADER_SIZE, true); // e_ehsize
  view.setUint16(42, PROGRAM_HEADER_SIZE, true); // e_phentsize
  view.setUint16(44, 1, true); // e_phnum
  view.setUint16(46, 0, true); // e_shentsize
  view.setUint16(48, 0, true); // e_shnum
  view.setUint16(50, 0, true); // e_shstrndx

  // ---- Program header (single PT_LOAD, RWX) ----
  view.setUint32(phOffset + 0, 1, true); // p_type = PT_LOAD
  view.setUint32(phOffset + 4, codeOffset, true); // p_offset
  view.setUint32(phOffset + 8, baseAddress, true); // p_vaddr
  view.setUint32(phOffset + 12, baseAddress, true); // p_paddr
  view.setUint32(phOffset + 16, code.length, true); // p_filesz
  view.setUint32(phOffset + 20, code.length, true); // p_memsz
  view.setUint32(phOffset + 24, 0x7, true); // p_flags = RWX
  view.setUint32(phOffset + 28, 0x1000, true); // p_align

  buf.set(code, codeOffset);

  return buf;
}
