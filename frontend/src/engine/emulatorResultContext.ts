// Exposes the most recent judge.kind 'emulator' run's raw EmulatorResult to
// the currently-rendered widget, so an emulator-judged step can show the
// real post-run register values it just produced instead of a placeholder
// ("?") — see docs/design/cogload-review-L0.md's L0-1 §4: "let LevelPlayer
// retain the successful EmulatorResult long enough to show `a0: — -> 3`
// before advancing." LevelPlayer.tsx sets this right after runEmulator()
// resolves (both pass and fail, so a wrong pick's real outcome is visible
// too) and clears it whenever the visible step changes. Mirrors
// submitState.ts's SubmitStateContext pattern.

import { createContext, useContext } from "react";
import type { EmulatorResult } from "./types";

export const EmulatorResultContext = createContext<EmulatorResult | null>(null);

export function useEmulatorResult(): EmulatorResult | null {
  return useContext(EmulatorResultContext);
}
