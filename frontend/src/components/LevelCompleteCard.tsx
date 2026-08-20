// Light "lesson complete" beat for ordinary (non-reward) level passes — see
// LevelPage.tsx's handleAdvance. Distinct tier from PassMoment: no confetti,
// no code, no rice-cooker illustration, just a quick checkmark + affirmation
// + continue tap, matching Duolingo's actual per-lesson completion screen
// (celebration only scales up for milestone/reward moments, handled by
// PassMoment instead). Do not merge these two components — they're
// deliberately different weight classes.

import { useState } from "react";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import "./LevelCompleteCard.css";

export interface LevelCompleteCardProps {
  /** The passed level's title, shown as-is. */
  title: string;
  onContinue: () => void;
}

// Small fixed pool so repeat visits (players re-doing levels at a booth)
// don't see the exact same line every time. Picked once per mount via a
// stable hash-free random pick — this is decorative copy, not state that
// needs to survive re-renders identically.
const AFFIRMATIONS = ["關卡完成！", "漂亮！", "搞定！", "太棒了！", "答對了！"];

export function LevelCompleteCard({
  title,
  onContinue,
}: LevelCompleteCardProps) {
  // Lazy initializer (not useMemo) so the impure Math.random() call runs
  // exactly once, at state init — the pattern the react-hooks/purity rule
  // expects for a stable one-time random pick.
  const [affirmation] = useState(
    () => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)],
  );
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="level-complete-overlay">
      <motion.div
        className="level-complete-card"
        initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
      >
        <div className="level-complete-icon">
          <Check className="icon" />
        </div>
        <h3>{affirmation}</h3>
        <p>{title}</p>
        <button
          type="button"
          className="widget-primary-btn"
          onClick={onContinue}
        >
          繼續
        </button>
      </motion.div>
    </div>
  );
}
