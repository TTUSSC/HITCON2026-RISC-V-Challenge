// Bubble/zigzag level-map ("泡泡蛇形路徑") — ports the approved style-demo
// markup verbatim (see task spec's reference HTML/CSS). Reads pass state
// from sessionStore to derive each node's done/current/locked status under
// simple linear gating: a node is locked until every node before it in the
// branch's ordered id list has passedAt set; the first not-yet-passed node
// is "current", everything after it is "locked".

import { Fragment, useEffect, useRef, useState } from "react";
import { Check, Lock, Award } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
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
  /**
   * Level ids whose onPass grants a real reward (hitcon-badge/ttussc-merch)
   * — the only levels that "count" as a real 通關, per the repo owner's
   * explicit L0-demotion decision (L0 is pure tutorial, never marked here
   * even once passed). Passed nodes in this set get an extra badge distinct
   * from the plain checkmark every other passed node gets.
   */
  rewardLevelIds?: Set<string>;
}

type NodeState = "done" | "current" | "locked";

export function PathMap({
  levelIds,
  captions,
  onSelectLevel,
  rewardLevelIds,
}: PathMapProps) {
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
  // so they have none and this is a no-op there). `smooth` per the repo
  // owner's explicit request; falls back to instant under
  // prefers-reduced-motion (matchMedia, not framer-motion's
  // useReducedMotion — this is a plain scrollIntoView call, no motion
  // component involved).
  const currentNodeId = nodes.find((n) => n.state === "current")?.id;
  const currentNodeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    currentNodeRef.current?.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    // Only re-run if which node is "current" actually changes (e.g. after
    // passing a level and coming back), not on every unrelated re-render.
  }, [currentNodeId]);

  // Tracks each node's state as of the *previous* render so a locked ->
  // current/done transition (a level just got passed and the player landed
  // back on /path — see sessionStore's recordPass) can be told apart from
  // "this node was already unlocked, nothing to animate" on every other
  // render. Uses the same "adjust state during render" pattern as
  // trackedLevelId in LevelPlayer.tsx (not a ref+effect) — reading a ref
  // during render to compute justUnlocked is exactly the footgun
  // react-hooks/refs is there to catch. Starts empty so the very first
  // render (initial page load) never pops in nodes that were unlocked from
  // the start.
  const [prevStates, setPrevStates] = useState<Record<string, NodeState>>({});
  const statesKey = nodes.map((n) => `${n.id}:${n.state}`).join(",");
  const [trackedStatesKey, setTrackedStatesKey] = useState(statesKey);
  let justUnlocked = new Set<string>();
  if (trackedStatesKey !== statesKey) {
    justUnlocked = new Set(
      nodes
        .filter((n) => prevStates[n.id] === "locked" && n.state !== "locked")
        .map((n) => n.id),
    );
    setTrackedStatesKey(statesKey);
    const next: Record<string, NodeState> = {};
    for (const node of nodes) next[node.id] = node.state;
    setPrevStates(next);
  }

  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="path">
      {nodes.map((node, i) => {
        const pop = justUnlocked.has(node.id) && !prefersReducedMotion;
        return (
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
              <motion.div
                className="bubble"
                initial={pop ? { scale: 0.4, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
              >
                {node.state === "done" ? (
                  <Check className="icon" />
                ) : node.state === "locked" ? (
                  <Lock className="icon" />
                ) : (
                  node.id
                )}
              </motion.div>
              {rewardLevelIds?.has(node.id) && (
                // Shown at every state, not just "done" — a locked/current
                // node still tells the player a reward is waiting there,
                // it just renders muted (see .reward-badge-pending in
                // PathMap.css) instead of the solid gold "already earned"
                // treatment done nodes get.
                <div
                  className={`reward-badge${
                    node.state === "done" ? "" : " reward-badge-pending"
                  }`}
                  title={
                    node.state === "done" ? "通關獎勵關卡" : "通關可獲得獎勵"
                  }
                >
                  <Award className="icon" />
                </div>
              )}
              <div className="caption">{captions?.[node.id] ?? node.id}</div>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
