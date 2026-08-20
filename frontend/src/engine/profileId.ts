// A stable per-browser identifier for "this person's profile" — distinct
// from sessionStore's sessionId, which is deliberately re-generated every
// day (see sessionStore.ts's persist `name`, date-stamped so booth sessions
// don't bleed across days). A profile should stay identifiable across days
// at a multi-day booth, so this lives under its own non-date-scoped
// localStorage key and is only ever created once per browser. It has no
// consumer yet (there's no backend), but exists so a future submission
// ("if there's time to build a backend") can key off it directly instead of
// retrofitting identity onto historical local data.

const STORAGE_KEY = "riscv-booth-profile-id";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateProfileId(): string {
  if (typeof localStorage === "undefined") return generateId();
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const created = generateId();
  localStorage.setItem(STORAGE_KEY, created);
  return created;
}

// "刪除帳號" — a fresh identity replaces the old one going forward. Old
// local data tied to the previous id (if a backend existed) would just be
// orphaned, same as deleting an account normally leaves no trace client-side.
export function regenerateProfileId(): string {
  const created = generateId();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, created);
  }
  return created;
}
