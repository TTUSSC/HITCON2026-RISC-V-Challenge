// General (non-stack) addressed-memory visual — built for L0-3's lw/sw
// content per docs/design/cogload-review-L0.md's #1 finding: L0-3 asks the
// learner to reason about a base register pointing at a word in memory, but
// had no memory visual at all (StackDiagram is tied to the buffer/canary/
// saved-s0/saved-ra stack layout specifically and is not a fit for general
// addressed memory — see the review's L0-3 §4).
//
// Renders the base-address register (via RegisterBank, so it reads as "the
// same kind of box" as everywhere else a register appears) next to a short
// row of word cells labeled by their byte offset from that base, with the
// base+offset target cell highlighted and a load/store direction caption
// toward `targetRegister`.

import { ArrowDown, ArrowUp } from "lucide-react";
import { RegisterBank } from "./RegisterBank";
import "./MemoryCells.css";

export interface MemoryCellSpec {
  offset: number;
  value?: string;
  label?: string;
}

export interface MemoryCellsProps {
  baseRegister: string;
  baseValue?: string;
  cells: MemoryCellSpec[];
  bytesPerCell?: number;
  highlightOffset?: number;
  direction?: "load" | "store";
  targetRegister?: string;
}

export function MemoryCells({
  baseRegister,
  baseValue,
  cells,
  bytesPerCell = 4,
  highlightOffset,
  direction,
  targetRegister,
}: MemoryCellsProps) {
  const sorted = [...cells].sort((a, b) => a.offset - b.offset);

  return (
    <div className="memory-cells">
      <div className="memory-cells-registers">
        <RegisterBank
          registers={[baseRegister]}
          values={{ [baseRegister]: baseValue ?? "位址" }}
          highlighted={baseRegister}
        />
        {targetRegister && (
          <>
            {direction === "store" ? (
              <ArrowDown size={18} className="memory-cells-arrow" />
            ) : (
              <ArrowUp size={18} className="memory-cells-arrow" />
            )}
            <RegisterBank registers={[targetRegister]} />
          </>
        )}
      </div>
      <div className="memory-cells-row">
        {sorted.map((cell) => {
          const isTarget = cell.offset === highlightOffset;
          return (
            <div
              key={cell.offset}
              className="memory-cell"
              data-target={isTarget || undefined}
            >
              <span className="memory-cell-offset">+{cell.offset}</span>
              <span
                className="memory-cell-value"
                data-empty={cell.value === undefined || undefined}
              >
                {cell.value}
              </span>
              {cell.label && (
                <span className="memory-cell-label">{cell.label}</span>
              )}
            </div>
          );
        })}
      </div>
      {direction && targetRegister && (
        <div className="memory-cells-direction">
          {direction === "load"
            ? `load：從 ${baseRegister} 指到的格子讀進 ${targetRegister}`
            : `store：把 ${targetRegister} 的值寫進 ${baseRegister} 指到的格子`}
        </div>
      )}
      <div className="memory-cells-legend">
        每格 {bytesPerCell} bytes（一個 word）
      </div>
    </div>
  );
}
