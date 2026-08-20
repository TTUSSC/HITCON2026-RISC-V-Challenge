// Bubble/zigzag level-map ("泡泡蛇形路徑") — ports the approved style-demo
// markup verbatim (see task spec's reference HTML/CSS). Reads pass state
// from sessionStore to derive each node's done/current/locked status under
// simple linear gating: a node is locked until every node before it in the
// branch's ordered id list has passedAt set; the first not-yet-passed node
// is "current", everything after it is "locked".

import { Fragment } from "react";
import { Check, Lock } from "lucide-react";
import { useSessionStore } from "../engine/sessionStore";
import "./PathMap.css";

export interface PathMapProps {
  /** Ordered level ids for the branch/segment currently being displayed. */
  levelIds: string[];
  /** The level currently being played (used for the alternating offset key). */
  currentLevelId: string;
  /** Short captions keyed by level id (falls back to the id itself). */
  captions?: Record<string, string>;
}

type NodeState = "done" | "current" | "locked";

export function PathMap({ levelIds, currentLevelId, captions }: PathMapProps) {
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

  return (
    <div className="path">
      {nodes.map((node, i) => (
        <Fragment key={node.id}>
          {i > 0 && <div className="connector" />}
          <div
            className={`node ${node.state}`}
            data-viewing={node.id === currentLevelId || undefined}
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
          </div>
        </Fragment>
      ))}
    </div>
  );
}
