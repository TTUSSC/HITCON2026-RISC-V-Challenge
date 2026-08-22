// Zustand store implementing SessionProgress (see types.ts / platform-architecture.md
// "本地 Metadata 追蹤"). Persisted to localStorage so a session survives a page
// reload during the booth demo, without any login/backend.
//
// sessionId is generated once on first load and then frozen by the persist
// middleware — every subsequent app boot rehydrates the same session until
// localStorage is cleared.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getOrCreateProfileId, regenerateProfileId } from "./profileId";
import { submitPass } from "./leaderboardClient";
import type { RewardKind, SessionProgress } from "./types";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older WebViews).
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface SessionStore extends SessionProgress {
  // Sets entryPoint + displayName + onboarded together, from EntryPage's
  // nickname-modal confirm — one commit rather than three separate setters
  // racing (see EntryPage.tsx).
  completeOnboarding: (
    entryPoint: SessionProgress["entryPoint"],
    displayName: string,
  ) => void;
  setDisplayName: (displayName: string) => void;
  enterLevel: (levelId: string) => void;
  recordPass: (levelId: string) => void;
  grantReward: (kind: RewardKind, levelId: string) => void;
  // Danger zone, both from ProfilePage. resetProgress clears run history
  // only (someone wanting to replay for speed); deleteProfile wipes the
  // profile identity itself, including handing out a fresh profileId, and
  // drops onboarded back to false so "/" becomes reachable again.
  resetProgress: () => void;
  deleteProfile: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessionId: generateSessionId(),
      profileId: getOrCreateProfileId(),
      displayName: "",
      onboarded: false,
      entryPoint: "L0",
      lastVisitedLevelId: null,
      events: [],
      rewards: [],

      completeOnboarding: (entryPoint, displayName) =>
        set({ entryPoint, displayName, onboarded: true }),
      setDisplayName: (displayName) => set({ displayName }),

      enterLevel: (levelId) =>
        set((state) => {
          const existing = state.events.find((e) => e.levelId === levelId);
          if (existing) {
            return {
              lastVisitedLevelId: levelId,
              events: state.events.map((e) =>
                e.levelId === levelId ? { ...e, attempts: e.attempts + 1 } : e,
              ),
            };
          }
          return {
            lastVisitedLevelId: levelId,
            events: [
              ...state.events,
              { levelId, enteredAt: Date.now(), attempts: 1 },
            ],
          };
        }),

      recordPass: (levelId) => {
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
        });

        // Fire-and-forget leaderboard upload. This is the only place in the app
        // a pass is recorded. It fires once per completion, and completed
        // levels stay replayable, so repeats are expected — the server's upsert
        // is idempotent and keeps the first clear time. It no-ops unless
        // VITE_LEADERBOARD_API is configured and never throws — see
        // leaderboardClient.ts.
        const state = get();
        void submitPass({
          profileId: state.profileId,
          displayName: state.displayName,
          entryPoint: state.entryPoint,
          levelId,
        });
      },

      grantReward: (kind, levelId) =>
        set((state) => ({
          rewards: [...state.rewards, { kind, grantedAt: Date.now(), levelId }],
        })),

      resetProgress: () =>
        set({ lastVisitedLevelId: null, events: [], rewards: [] }),

      deleteProfile: () =>
        set({
          profileId: regenerateProfileId(),
          displayName: "",
          onboarded: false,
          entryPoint: "L0",
          lastVisitedLevelId: null,
          events: [],
          rewards: [],
        }),
    }),
    {
      // Key intentionally includes a date stamp so sessions don't bleed
      // across days at a multi-day booth (per platform-architecture.md).
      name: `riscv-booth-session-${new Date().toISOString().slice(0, 10)}`,
    },
  ),
);
