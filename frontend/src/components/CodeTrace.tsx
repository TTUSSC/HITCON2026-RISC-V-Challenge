// Branch/jump code-trace visual — built for L0-4's flow content (and L0-2's
// jal/jalr exposition screen) per docs/design/cogload-review-L0.md's #1
// finding: branching is a sequence/flow concept, but ObservationWidget had
// no assembly-line rendering with a current-line highlight, destination
// label, or taken/fall-through fork — RegisterBank can't show instruction
// order and StackDiagram is unrelated.
//
// v1 of this component rendered each line as a bordered table row with
// text badges ("成立 -> 跳到這" / "不成立 -> 往下" / "實際執行 ✓") — the
// repo owner flagged that as reading like a plain table, not a flow
// visual. This version keeps the code lines as a clean monospace block
// (matching widgets.css's .fill-blank-code language) and draws the actual
// branch/fall-through relationship as SVG connector curves in a gutter next
// to the code — same idea as PathMap.tsx's node-to-node bezier connectors,
// applied to "this line's control flow can go to that line" instead of
// "this map node leads to that map node". A jump is something the learner
// sees as a curve leaving one row and landing on another, not something
// they read off a badge.
//
// Row centers are measured from the real DOM (offsetTop/offsetHeight of
// each row, re-measured via ResizeObserver) rather than approximated with a
// stretched percentage viewBox — a non-uniformly-scaled SVG (width scale
// != height scale, which a fixed-width gutter next to variable-row-count
// code would need) distorts stroke width and skews arrowhead markers along
// the curve. Measuring gives the gutter SVG a 1:1 pixel viewBox, so strokes
// and arrowheads render exactly as authored regardless of how many rows or
// how tall the font renders.

import { useLayoutEffect, useRef, useState } from "react";
import "./CodeTrace.css";

export interface CodeTraceLine {
  id: string;
  text: string;
  label?: string;
}

export interface CodeTraceProps {
  lines: CodeTraceLine[];
  currentLineId?: string;
  fallthroughLineId?: string;
  takenLineId?: string;
  executedPath?: "taken" | "fallthrough";
}

const GUTTER_W = 56;

// Same-side "repeat bracket" curve: leaves the source row on the gutter's
// left edge, bulges right to `bulge` px, and lands back on the left edge at
// the target row — reads as "control leaves here, arrives there" without
// crossing over the code text itself.
function connectorPath(y1: number, y2: number, bulge: number) {
  return `M 0,${y1} C ${bulge},${y1} ${bulge},${y2} 0,${y2}`;
}

export function CodeTrace({
  lines,
  currentLineId,
  fallthroughLineId,
  takenLineId,
  executedPath,
}: CodeTraceProps) {
  const codeRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [rowCenters, setRowCenters] = useState<Record<string, number>>({});
  const [totalHeight, setTotalHeight] = useState(0);

  useLayoutEffect(() => {
    const container = codeRef.current;
    if (!container) return;

    const measure = () => {
      const containerTop = container.getBoundingClientRect().top;
      const centers: Record<string, number> = {};
      for (const line of lines) {
        const el = rowRefs.current[line.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        centers[line.id] = rect.top - containerTop + rect.height / 2;
      }
      setRowCenters(centers);
      setTotalHeight(container.getBoundingClientRect().height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
    // Re-measure whenever the set of lines changes (a new step swaps
    // content) — the ResizeObserver alone wouldn't catch a same-height
    // relayout triggered by different text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map((l) => l.id).join(",")]);

  const currentY = currentLineId ? rowCenters[currentLineId] : undefined;
  const fallthroughY = fallthroughLineId
    ? rowCenters[fallthroughLineId]
    : undefined;
  const takenY = takenLineId ? rowCenters[takenLineId] : undefined;
  const showFlow =
    currentY !== undefined &&
    (fallthroughY !== undefined || takenY !== undefined);

  return (
    <div className="code-trace">
      <div className="code-trace-code" ref={codeRef}>
        {lines.map((line) => (
          <div
            key={line.id}
            ref={(el) => {
              rowRefs.current[line.id] = el;
            }}
            className="code-trace-line"
            data-current={line.id === currentLineId || undefined}
            data-executed={
              (executedPath === "taken" && line.id === takenLineId) ||
              (executedPath === "fallthrough" &&
                line.id === fallthroughLineId) ||
              undefined
            }
          >
            <span className="code-trace-label">{line.label ?? ""}</span>
            <span className="code-trace-text">{line.text}</span>
          </div>
        ))}
      </div>
      {showFlow && currentY !== undefined && totalHeight > 0 && (
        <svg
          className="code-trace-flow"
          width={GUTTER_W}
          height={totalHeight}
          viewBox={`0 0 ${GUTTER_W} ${totalHeight}`}
          aria-hidden="true"
        >
          <defs>
            {/* fill="context-stroke" picks up whichever path references this
                marker's own stroke color, so one definition serves both the
                fallthrough and taken curves (and their executed/muted
                states) without a marker-per-color duplication. */}
            <marker
              id="code-trace-arrowhead"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
            </marker>
          </defs>
          {fallthroughY !== undefined && (
            <path
              d={connectorPath(currentY, fallthroughY, GUTTER_W * 0.35)}
              className="code-trace-flow-path"
              data-kind="fallthrough"
              data-executed={executedPath === "fallthrough" || undefined}
              markerEnd="url(#code-trace-arrowhead)"
            />
          )}
          {takenY !== undefined && (
            <path
              d={connectorPath(currentY, takenY, GUTTER_W * 0.78)}
              className="code-trace-flow-path"
              data-kind="taken"
              data-executed={executedPath === "taken" || undefined}
              markerEnd="url(#code-trace-arrowhead)"
            />
          )}
        </svg>
      )}
    </div>
  );
}
