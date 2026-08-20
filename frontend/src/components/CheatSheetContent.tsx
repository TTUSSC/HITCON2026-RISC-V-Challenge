// Reference content for the RISC-V/syscall quick-reference — syscall table,
// register role table, taught-instruction quick-syntax list. Pure
// presentation, no overlay/panel chrome, so it can be rendered two ways:
// - CheatSheet.tsx wraps this in a slide-up sheet, triggered from
//   LevelPage.tsx's topbar (in-lesson quick glance).
// - A standalone full-page route (wired up by a separate task) can render
//   this directly without duplicating the syscall/register/instruction data.
//
// Content is intentionally static/hardcoded, not level-schema-driven.
// Verified against the actual engine, not eyeballed:
// - syscall numbers: docs/design/levels.md L2-0/L2-1 + the ABI table
//   (open=1024, read=63, write=64, exit=93).
// - register set: engine/assembler/registers.ts, scoped down to exactly the
//   registers levels.md's curriculum actually teaches/references (a0-a7,
//   ra, sp) — L1's design note explicitly says t0-t6/s0-s11's
//   caller/callee-saved distinction is NOT taught anywhere downstream, so
//   they're deliberately left out rather than padding the table.
// - instruction list + syntax: engine/assembler/assemble.ts's real switch
//   cases (pseudo-instructions nop/ret/mv/li/la, then the real opcodes).

import "./CheatSheet.css";

interface SyscallRow {
  name: string;
  a7: number;
  args: string;
}

const SYSCALLS: SyscallRow[] = [
  { name: "write", a7: 64, args: "a0=fd, a1=buf, a2=len" },
  { name: "read", a7: 63, args: "a0=fd, a1=buf, a2=len" },
  { name: "open", a7: 1024, args: "a0=path, a1=flags" },
  { name: "exit", a7: 93, args: "a0=code" },
];

interface RegisterRow {
  name: string;
  role: string;
}

// Scoped to exactly what levels.md's curriculum teaches — see file header.
const REGISTERS: RegisterRow[] = [
  { name: "a0-a6", role: "syscall 參數 / 函式參數" },
  { name: "a7", role: "syscall 編號" },
  { name: "ra", role: "return address（函式該跳回哪）" },
  { name: "sp", role: "stack pointer" },
];

interface InstructionRow {
  mnemonic: string;
  syntax: string;
  note: string;
}

// Verified 1:1 against assemble.ts's supported switch cases (pseudo-instr
// first, matching the comment order in that file's header).
const INSTRUCTIONS: InstructionRow[] = [
  { mnemonic: "li", syntax: "li rd, imm", note: "rd = imm（立即值載入）" },
  { mnemonic: "la", syntax: "la rd, label", note: "rd = label 的位址" },
  { mnemonic: "mv", syntax: "mv rd, rs", note: "rd = rs" },
  { mnemonic: "nop", syntax: "nop", note: "什麼都不做" },
  { mnemonic: "ret", syntax: "ret", note: "跳回 ra（jalr x0, ra, 0）" },
  { mnemonic: "add", syntax: "add rd, rs1, rs2", note: "rd = rs1 + rs2" },
  { mnemonic: "sub", syntax: "sub rd, rs1, rs2", note: "rd = rs1 - rs2" },
  { mnemonic: "addi", syntax: "addi rd, rs1, imm", note: "rd = rs1 + imm" },
  { mnemonic: "lui", syntax: "lui rd, imm", note: "rd = imm << 12" },
  {
    mnemonic: "auipc",
    syntax: "auipc rd, imm",
    note: "rd = pc + (imm << 12)",
  },
  { mnemonic: "lw", syntax: "lw rd, offset(rs1)", note: "rd = *(rs1+offset)" },
  {
    mnemonic: "sw",
    syntax: "sw rs2, offset(rs1)",
    note: "*(rs1+offset) = rs2",
  },
  {
    mnemonic: "beq",
    syntax: "beq rs1, rs2, label",
    note: "rs1 == rs2 時跳轉",
  },
  {
    mnemonic: "bne",
    syntax: "bne rs1, rs2, label",
    note: "rs1 != rs2 時跳轉",
  },
  {
    mnemonic: "blt",
    syntax: "blt rs1, rs2, label",
    note: "rs1 < rs2 時跳轉",
  },
  {
    mnemonic: "bge",
    syntax: "bge rs1, rs2, label",
    note: "rs1 >= rs2 時跳轉",
  },
  {
    mnemonic: "jal",
    syntax: "jal [rd,] label",
    note: "跳轉並存回址（預設 rd=ra）",
  },
  {
    mnemonic: "jalr",
    syntax: "jalr rd, rs1, imm",
    note: "rd = pc+4; pc = rs1+imm",
  },
  { mnemonic: "ecall", syntax: "ecall", note: "觸發 syscall（見上表）" },
];

export function CheatSheetContent() {
  return (
    <div className="cheatsheet-content">
      <section className="cheatsheet-section">
        <h3>Syscall</h3>
        <p className="cheatsheet-hint">
          呼叫慣例：<code>a7</code> = syscall 編號，<code>a0</code>-
          <code>a6</code> = 參數，接一個 <code>ecall</code>。
        </p>
        <div className="cheatsheet-table">
          <div className="cheatsheet-row cheatsheet-row-head">
            <span>名稱</span>
            <span>a7</span>
            <span>參數</span>
          </div>
          {SYSCALLS.map((s) => (
            <div className="cheatsheet-row" key={s.name}>
              <span className="cheatsheet-mono">{s.name}</span>
              <span className="cheatsheet-mono">{s.a7}</span>
              <span className="cheatsheet-mono">{s.args}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cheatsheet-section">
        <h3>暫存器</h3>
        <div className="cheatsheet-table cheatsheet-table-registers">
          <div className="cheatsheet-row cheatsheet-row-head">
            <span>名稱</span>
            <span>用途</span>
          </div>
          {REGISTERS.map((r) => (
            <div className="cheatsheet-row" key={r.name}>
              <span className="cheatsheet-mono">{r.name}</span>
              <span>{r.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cheatsheet-section">
        <h3>指令</h3>
        <div className="cheatsheet-table cheatsheet-table-instr">
          <div className="cheatsheet-row cheatsheet-row-head">
            <span>語法</span>
            <span>說明</span>
          </div>
          {INSTRUCTIONS.map((i) => (
            <div className="cheatsheet-row" key={i.mnemonic}>
              <span className="cheatsheet-mono">{i.syntax}</span>
              <span>{i.note}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
