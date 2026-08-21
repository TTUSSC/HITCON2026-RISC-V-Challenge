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
  /**
   * Level id to scroll to instead of the "current" (furthest-unpassed)
   * node — the level right after wherever the player last visited, so
   * replaying an old already-passed level and exiting scrolls back near
   * there instead of jumping forward to the player's overall frontier
   * (see MapPage.tsx). Only takes effect if this id is actually one of
   * this branch's `levelIds`; otherwise falls back to the "current" node
   * exactly as before.
   */
  scrollTargetLevelId?: string;
}

type NodeState = "done" | "current" | "locked";

export function PathMap({
  levelIds,
  captions,
  onSelectLevel,
  rewardLevelIds,
  scrollTargetLevelId,
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

  // Auto-scroll into view on mount — with multiple branch sections now
  // stacked on the map (see MapPage.tsx's cross-branch-visibility fix),
  // MapPage renders one PathMap instance PER visible branch, and every one
  // of them independently runs this effect on mount. That used to be the
  // actual bug behind "replaying an old level still scrolls to the
  // frontier": scrollTargetLevelId only ever belongs to ONE branch, but
  // every OTHER branch's instance (frontier branch included, since it's
  // usually not fully passed and so still has a real "current" node) fell
  // back to scrolling to ITS OWN current node — and since it renders later
  // in BRANCH_ORDER, its scrollIntoView call ran after the correct one and
  // won. Fix: once a scrollTargetLevelId exists at all, ONLY the branch
  // that actually contains it may scroll — every other branch does nothing,
  // instead of each independently falling back to its own current node.
  // The old "fall back to current" behavior only applies when
  // scrollTargetLevelId itself is undefined (a fresh session with no
  // last-visited level yet, or the player's last-visited level was the
  // very last one in the whole game) — in that case only one branch has a
  // node in "current" state to begin with, so there's nothing to conflict
  // with. `smooth` per the repo owner's explicit request; falls back to
  // instant under prefers-reduced-motion (matchMedia, not framer-motion's
  // useReducedMotion — this is a plain scrollIntoView call, no motion
  // component involved).
  const currentNodeId = nodes.find((n) => n.state === "current")?.id;
  const hasScrollTargetInBranch =
    scrollTargetLevelId !== undefined &&
    nodes.some((n) => n.id === scrollTargetLevelId);
  const currentNodeRef = useRef<HTMLButtonElement | null>(null);
  const scrollTargetRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const target =
      scrollTargetLevelId !== undefined
        ? hasScrollTargetInBranch
          ? scrollTargetRef.current
          : null
        : currentNodeRef.current;
    target?.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    // Re-run when either candidate target changes (e.g. after passing a
    // level, or after visiting a different level and coming back).
  }, [currentNodeId, hasScrollTargetInBranch, scrollTargetLevelId]);

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
            {i > 0 && (
              // Segment leading *into* this node — an S-curve bezier (per
              // real Duolingo / open-source Duolingo-clone path screens,
              // which sweep the connector between the alternating
              // left/right node offsets rather than drawing a straight
              // vertical bar). Colored/traveled once this node is reachable
              // (done or current), muted grey while it still leads to a
              // locked node — mirrors how the bubbles themselves
              // distinguish reached vs. not-yet-reached.
              //
              // Direction follows the same i%2 parity the node offset below
              // uses: an odd-index node is shifted right (marginLeft), so
              // the curve into it sweeps left-to-right; an even-index node
              // is shifted left (marginRight), so the curve sweeps
              // right-to-left.
              <svg
                className={`connector connector-${node.state}`}
                width="44"
                height="34"
                viewBox="0 0 44 34"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d={
                    i % 2 === 1
                      ? "M14 0 C14 17, 30 17, 30 34"
                      : "M30 0 C30 17, 14 17, 14 34"
                  }
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="0.1 13.5"
                />
              </svg>
            )}
            <button
              type="button"
              ref={
                node.id === scrollTargetLevelId
                  ? scrollTargetRef
                  : node.state === "current"
                    ? currentNodeRef
                    : undefined
              }
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
