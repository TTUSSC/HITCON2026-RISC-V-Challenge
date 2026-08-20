// Bubble/zigzag level-map ("泡泡蛇形路徑") — ports the approved style-demo
// markup verbatim (see task spec's reference HTML/CSS). Reads pass state
// from sessionStore to derive each node's done/current/locked status under
// simple linear gating: a node is locked until every node before it in the
// branch's ordered id list has passedAt set; the first not-yet-passed node
// is "current", everything after it is "locked".

import { Fragment, useEffect, useRef } from "react";
import { Check, Lock } from "lucide-react";
import { useSessionStore } from "../engine/sessionStore";
import "./PathMap.css";

export interface PathMapProps {
  /** Ordered level ids for the branch/segment currently being displayed. */
  levelIds: string[];
  /** Short captions keyed by level id (falls back to the id itself). */
  captions?: Record<string, string>;
  /**
   * Called when a reachable (done/current) node is tapped. Locked nodes
   * never call this — they're rendered disabled instead.
   */
  onSelectLevel?: (levelId: string) => void;
}

type NodeState = "done" | "current" | "locked";

export function PathMap({ levelIds, captions, onSelectLevel }: PathMapProps) {
  const events = useSessionStore((s) => s.events);
  const passedIds = new Set(
    events.filter((e) => e.passedAt !== undefined).map((e) => e.levelId),
  );

  // Linear gating: everything up to (and including) the first not-yet-passed
  // node is reachable; that first not-yet-passed node is "current", the
  // rest are "locked". If every node in the segment is already passed,
  // nothing is "current" — the segment is fully cleared.
  const firstUnpassedIndex = levelIds.findIndex((id) => !passedIds.has(id));

  const nodes = levelIds.map((id, i): { id: string; state: NodeState } => {
    if (passedIds.has(id)) return { id, state: "done" };
    if (i === firstUnpassedIndex) return { id, state: "current" };
    return { id, state: "locked" };
  });

  // Auto-scroll the "current" node (whichever the player would tap next)
  // into view on mount — with multiple branch sections now stacked on the
  // map (see MapPage.tsx's cross-branch-visibility fix), a returning player
  // could otherwise land looking at old completed nodes from an earlier
  // branch instead of their actual position. Only the branch that actually
  // contains a "current" node scrolls (earlier branches are fully passed,
  // so they have none and this is a no-op there); `behavior: 'auto'`
  // (instant) rather than 'smooth' since this fires on first paint, where a
  // scroll animation would just read as janky.
  const currentNodeId = nodes.find((n) => n.state === "current")?.id;
  const currentNodeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    currentNodeRef.current?.scrollIntoView({
      block: "center",
      behavior: "auto",
    });
    // Only re-run if which node is "current" actually changes (e.g. after
    // passing a level and coming back), not on every unrelated re-render.
  }, [currentNodeId]);

  return (
    <div className="path">
      {nodes.map((node, i) => (
        <Fragment key={node.id}>
          {i > 0 && <div className="connector" />}
          <button
            type="button"
            ref={node.state === "current" ? currentNodeRef : undefined}
            className={`node ${node.state}`}
            disabled={node.state === "locked"}
            data-level-id={node.id}
            onClick={() => onSelectLevel?.(node.id)}
            style={{
              marginLeft: i % 2 === 1 ? "1.4rem" : undefined,
              marginRight: i % 2 === 0 ? "1.4rem" : undefined,
            }}
          >
            <div className="bubble">
              {node.state === "done" ? (
                <Check className="icon" />
              ) : node.state === "locked" ? (
                <Lock className="icon" />
              ) : (
                node.id
              )}
            </div>
            <div className="caption">{captions?.[node.id] ?? node.id}</div>
          </button>
        </Fragment>
      ))}
    </div>
  );
}
