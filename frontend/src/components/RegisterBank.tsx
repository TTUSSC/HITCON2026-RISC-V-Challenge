// Row of labeled register boxes (a0–a7, plus ra/sp where relevant) for
// L1's calling-convention fill-blank levels (L1-2/L1-3). Opt-in per level
// via FillBlankLevel.registerContext (see types.ts) — absent for
// non-register fill-blanks like L0-1's arithmetic questions.
//
// `values` maps a register name to its currently-known value (e.g. once
// the user picks/submits an answer); `highlighted` marks which register
// box should be emphasized (e.g. the blank currently being answered).

import "./RegisterBank.css";

export interface RegisterBankProps {
  registers: string[];
  values?: Partial<Record<string, string>>;
  highlighted?: string;
}

export function RegisterBank({
  registers,
  values = {},
  highlighted,
}: RegisterBankProps) {
  return (
    <div className="register-bank">
      {registers.map((reg) => {
        const value = values[reg];
        return (
          <div
            key={reg}
            className="register-box"
            data-highlighted={reg === highlighted || undefined}
            data-filled={value !== undefined || undefined}
          >
            <span className="register-box-name">{reg}</span>
            <span className="register-box-value">
              {value !== undefined ? value : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
