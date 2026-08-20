// Persistent on-demand quick-reference panel, reachable from every lesson
// screen (see LevelPage.tsx's topbar). Solves a specific pain point: the
// freehand-editor/drag-order/gadget-chain widgets require recalling syscall
// numbers and register conventions purely from memory, with zero reference
// material on screen — that's a pure memorization burden unrelated to actual
// understanding, not a difficulty-design choice, so a static reference panel
// addresses it directly without touching any level's schema/content.
//
// Rendered as a bottom sheet (not a full modal) — the player likely wants to
// glance at it while their in-progress work (partially-typed freehand code,
// partially-selected drag items) is still visible underneath, matching this
// app's mobile-first Duolingo-style conventions. It's a sibling overlay to
// LevelPlayer, not a route change, so LevelPlayer never unmounts while this
// is open/closed — in-progress widget state survives automatically.
//
// This component is ONLY overlay chrome (backdrop, sheet, header, close
// button) — the actual reference tables live in CheatSheetContent.tsx so a
// separate standalone full-page route can reuse the exact same content
// without duplicating the syscall/register/instruction data.

import { BookOpen, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheatSheetContent } from "./CheatSheetContent";
import "./CheatSheet.css";

export interface CheatSheetProps {
  open: boolean;
  onClose: () => void;
}

export function CheatSheet({ open, onClose }: CheatSheetProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cheatsheet-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          <motion.div
            className="cheatsheet-sheet"
            role="dialog"
            aria-label="速查表"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: prefersReducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: prefersReducedMotion ? 0 : "100%" }}
            transition={{
              type: prefersReducedMotion ? "tween" : "spring",
              stiffness: 380,
              damping: 34,
            }}
          >
            <div className="cheatsheet-header">
              <div className="cheatsheet-title">
                <BookOpen size={18} />
                <span>速查表</span>
              </div>
              <button
                type="button"
                className="cheatsheet-close-btn"
                onClick={onClose}
                aria-label="關閉速查表"
              >
                <X size={20} />
              </button>
            </div>

            <div className="cheatsheet-body">
              <CheatSheetContent />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
