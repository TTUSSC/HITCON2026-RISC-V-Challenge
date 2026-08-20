// Row of labeled register boxes (a0–a7, plus ra/sp where relevant) for
// L1's calling-convention fill-blank levels (L1-2/L1-3). Opt-in per level
// via FillBlankStep.registerContext (see types.ts) — absent for
// non-register fill-blanks like L0-1's arithmetic questions.
//
// `values` maps a register name to its currently-known value (e.g. once
// the user picks/submits an answer); `highlighted` marks which register
// box should be emphasized (e.g. the blank currently being answered).
//
// `after` is optional and, when a register appears in both `values` and
// `after`, renders a before -> after transition inside that one box (e.g.
// "— -> 3") instead of a single static value — the execution-state visual
// the L0 cognitive-load review asked for (docs/design/cogload-review-L0.md):
// a worked example or a resolved practice step should show what the real
// register actually became, not just its final value in isolation. A
// register present only in `values` (no `after`) still renders as a plain
// single value, so this is purely additive for existing callers.

import "./RegisterBank.css";

export interface RegisterBankProps {
  registers: string[];
  values?: Partial<Record<string, string>>;
  after?: Partial<Record<string, string>>;
  highlighted?: string;
}

export function RegisterBank({
  registers,
  values = {},
  after = {},
  highlighted,
}: RegisterBankProps) {
  return (
    <div className="register-bank">
      {registers.map((reg) => {
        const before = values[reg];
        const afterValue = after[reg];
        const hasTransition = afterValue !== undefined;
        return (
          <div
            key={reg}
            className="register-box"
            data-highlighted={reg === highlighted || undefined}
            data-filled={
              (hasTransition ? true : before !== undefined) || undefined
            }
          >
            <span className="register-box-name">{reg}</span>
            <span className="register-box-value">
              {hasTransition ? (
                <>
                  {before !== undefined ? before : "—"}
                  <span className="register-box-arrow"> → </span>
                  {afterValue}
                </>
              ) : before !== undefined ? (
                before
              ) : (
                "—"
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
