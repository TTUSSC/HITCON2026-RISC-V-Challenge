// Vertical stack-memory visualization — the payoff moment for the
// stack-overflow teaching arc (L2-5a "find the offset" / L3-1 "hit the
// canary wall", see docs/design/levels.md's Boss section ASCII diagram).
//
// Renders low address at the bottom, high address at the top, exactly
// matching levels.md's own diagram:
//
//   ┌─────────────┐  高位址
//   │ saved ra    │
//   ├─────────────┤
//   │ saved s0    │
//   ├─────────────┤
//   │ canary      │  (mode === 'canary' only)
//   ├─────────────┤
//   │ buffer      │
//   └─────────────┘  低位址
//
// Bytes are grouped into 4-byte rows for visual density. `fillLength` is a
// live value (typically driven by a slider) — bytes [0, fillLength) are
// marked "filled"; any filled byte that lands outside the buffer region is
// "corrupted" (the overflow eating saved s0 / saved ra). In 'canary' mode,
// a filled canary byte additionally flips the region into a "detected"
// state (levels.md L3-1's "觸發偵測當掉" payoff).

import { TriangleAlert } from "lucide-react";
import "./StackDiagram.css";

export type StackRegionKind = "buffer" | "canary" | "savedS0" | "savedRa";

export interface StackDiagramProps {
  bufferSize: number;
  mode: "offset" | "canary";
  canarySize?: number;
  savedS0Size: number;
  savedRaSize: number;
  fillLength: number;
  regionLabels?: Partial<Record<StackRegionKind, string>>;
}

const DEFAULT_LABELS: Record<StackRegionKind, string> = {
  buffer: "buffer ← 輸入從這裡開始",
  canary: "canary ← 沖到會被抓",
  savedS0: "saved s0 ← 可隨意填",
  savedRa: "saved ra ← 被劫持的目標",
};

const BYTES_PER_ROW = 4;

interface Region {
  kind: StackRegionKind;
  size: number;
  start: number; // byte offset from the bottom of the buffer (address 0)
  label: string;
  className: string;
}

function buildRegions(props: StackDiagramProps): Region[] {
  const {
    bufferSize,
    mode,
    canarySize = 4,
    savedS0Size,
    savedRaSize,
    regionLabels,
  } = props;

  const labels = { ...DEFAULT_LABELS, ...regionLabels };
  let cursor = 0;
  const regions: Region[] = [];

  regions.push({
    kind: "buffer",
    size: bufferSize,
    start: cursor,
    label: labels.buffer,
    className: "stack-region-buffer",
  });
  cursor += bufferSize;

  if (mode === "canary") {
    regions.push({
      kind: "canary",
      size: canarySize,
      start: cursor,
      label: labels.canary,
      className: "stack-region-canary",
    });
    cursor += canarySize;
  }

  regions.push({
    kind: "savedS0",
    size: savedS0Size,
    start: cursor,
    label: labels.savedS0,
    className: "stack-region-saved-s0",
  });
  cursor += savedS0Size;

  regions.push({
    kind: "savedRa",
    size: savedRaSize,
    start: cursor,
    label: labels.savedRa,
    className: "stack-region-saved-ra",
  });

  // Render high address (saved ra) first, low address (buffer) last.
  return regions.reverse();
}

export function StackDiagram(props: StackDiagramProps) {
  const { fillLength } = props;
  const regions = buildRegions(props);

  const canaryRegion = regions.find((r) => r.kind === "canary");
  const canaryDetected =
    canaryRegion !== undefined &&
    fillLength > canaryRegion.start &&
    props.mode === "canary";

  return (
    <div className="stack-diagram">
      <div className="stack-diagram-addr-label stack-diagram-addr-high">
        高位址
      </div>
      <div className="stack-diagram-body">
        {regions.map((region) => {
          const rowCount = Math.ceil(region.size / BYTES_PER_ROW);
          // Built low-to-high (rowIdx 0 = the region's lowest byte offset),
          // then reversed so the DOM (and .stack-region-cells' plain
          // top-to-bottom column flex) renders the highest-offset row
          // first/top and the lowest-offset row last/bottom — matching the
          // outer `regions.reverse()` convention (low address at the
          // bottom of the whole diagram). Without this, each region's own
          // rows filled top-to-bottom while the diagram overall was
          // supposed to read bottom-to-top.
          const rows = Array.from({ length: rowCount }, (_, rowIdx) => {
            const rowStartByte = region.start + rowIdx * BYTES_PER_ROW;
            const rowByteCount = Math.min(
              BYTES_PER_ROW,
              region.size - rowIdx * BYTES_PER_ROW,
            );
            return { rowStartByte, rowByteCount };
          }).reverse();

          const isDetected = region.kind === "canary" && canaryDetected;

          return (
            <div
              key={region.kind}
              className={`stack-region ${region.className}`}
              data-detected={isDetected || undefined}
            >
              <div className="stack-region-cells">
                {rows.map(({ rowStartByte, rowByteCount }) => (
                  <div className="stack-byte-row" key={rowStartByte}>
                    {Array.from({ length: rowByteCount }, (_, i) => {
                      const byteIndex = rowStartByte + i;
                      const filled = byteIndex < fillLength;
                      const corrupted = filled && region.kind !== "buffer";
                      return (
                        <div
                          key={byteIndex}
                          className="stack-byte-cell"
                          data-filled={filled || undefined}
                          data-corrupted={corrupted || undefined}
                          title={`offset ${byteIndex}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="stack-region-label">
                {isDetected && (
                  <TriangleAlert size={16} className="stack-region-alert" />
                )}
                <span className="stack-region-label-text">
                  {isDetected ? "偵測到！stack smashing" : region.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="stack-diagram-addr-label stack-diagram-addr-low">
        低位址
      </div>
    </div>
  );
}
