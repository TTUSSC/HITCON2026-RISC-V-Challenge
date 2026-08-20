// Zustand store implementing SessionProgress (see types.ts / platform-architecture.md
// "本地 Metadata 追蹤"). Persisted to localStorage so a session survives a page
// reload during the booth demo, without any login/backend.
//
// sessionId is generated once on first load and then frozen by the persist
// middleware — every subsequent app boot rehydrates the same session until
// localStorage is cleared.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RewardKind, SessionProgress } from "./types";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older WebViews).
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface SessionStore extends SessionProgress {
  setEntryPoint: (entryPoint: SessionProgress["entryPoint"]) => void;
  setDisplayName: (displayName: string) => void;
  enterLevel: (levelId: string) => void;
  recordPass: (levelId: string) => void;
  grantReward: (kind: RewardKind, levelId: string) => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      sessionId: generateSessionId(),
      displayName: "",
      entryPoint: "L0",
      events: [],
      rewards: [],

      setEntryPoint: (entryPoint) => set({ entryPoint }),
      setDisplayName: (displayName) => set({ displayName }),

      enterLevel: (levelId) =>
        set((state) => {
          const existing = state.events.find((e) => e.levelId === levelId);
          if (existing) {
            return {
              events: state.events.map((e) =>
                e.levelId === levelId ? { ...e, attempts: e.attempts + 1 } : e,
              ),
            };
          }
          return {
            events: [
              ...state.events,
              { levelId, enteredAt: Date.now(), attempts: 1 },
            ],
          };
        }),

      recordPass: (levelId) =>
        set((state) => {
          const existing = state.events.find((e) => e.levelId === levelId);
          if (!existing) {
            // Passed without a recorded enter — still record it defensively.
            return {
              events: [
                ...state.events,
                {
                  levelId,
                  enteredAt: Date.now(),
                  passedAt: Date.now(),
                  attempts: 1,
                },
              ],
            };
          }
          return {
            events: state.events.map((e) =>
              e.levelId === levelId ? { ...e, passedAt: Date.now() } : e,
            ),
          };
        }),

      grantReward: (kind, levelId) =>
        set((state) => ({
          rewards: [...state.rewards, { kind, grantedAt: Date.now(), levelId }],
        })),
    }),
    {
      // Key intentionally includes a date stamp so sessions don't bleed
      // across days at a multi-day booth (per platform-architecture.md).
      name: `riscv-booth-session-${new Date().toISOString().slice(0, 10)}`,
    },
  ),
);
