import { describe, expect, it } from "vitest";
import { levels } from "../../../frontend/src/engine/levels";
import { LEVEL_ORDER } from "../../src/shared/levels";

// Guards the one duplicated fact in this repo. The backend cannot import the
// frontend's level data at runtime (separate deploys), so it keeps its own
// copy; this test is what stops that copy from silently rotting when someone
// adds, removes, or reorders a level in frontend/src/engine/levels.ts.
describe("LEVEL_ORDER drift guard", () => {
  it("matches the frontend's canonical chain exactly", () => {
    expect([...LEVEL_ORDER]).toEqual(levels.map((level) => level.id));
  });
});
