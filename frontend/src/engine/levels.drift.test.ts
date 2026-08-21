/// <reference types="node" />
// The project's tsconfig.app.json deliberately restricts "types" to just
// "vite/client" so app code doesn't get Node globals it will never have at
// runtime in the browser. This file is the one legitimate exception (it
// only ever runs under Node, via vitest) and pulls in just enough of
// @types/node -- via this file-scoped reference directive rather than
// widening the shared tsconfig -- to resolve the node: imports below.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { levels } from "./levels";

// Guards the one duplicated fact in this repo -- reversed from where it used
// to live. The old TypeScript backend could afford
// backend/test/shared/levelOrder.drift.test.ts because both sides were
// TypeScript, so a test could `import` the frontend's `levels` module
// directly. The Python backend (backend/src/shared/levels.py) cannot import
// a .ts module at runtime at all, so exactly one side of this comparison has
// to be parsed as text instead of imported. This file is that side: it does
// a genuine `import` of the frontend's own canonical `levels` (never
// re-derived or hand-copied), and only *parses* the Python file, because a
// flat Python tuple of string literals is a far safer thing to regex than a
// ~2000-line TypeScript module full of nested objects and types.
//
// Living in the frontend also means this goes red at the moment and place
// someone edits the level chain, rather than waiting for someone to
// remember to run the backend's test suite. See
// docs/superpowers/specs/2026-08-21-leaderboard-backend-design.md §6.

// Deliberately *not* `fileURLToPath(new URL("../../../backend/...", import
// .meta.url))`, even though that's the usual Node idiom: under this
// project's vitest.config.ts (which loads the same `@vitejs/plugin-react`
// pipeline as the app build, for jsdom + JSX support), Vite statically
// recognizes the exact syntactic shape `new URL("literal", import.meta.url)`
// as its asset-URL convention and rewrites it into a dev-server request
// (observed: it resolves to `http://localhost:3000/@fs/...` instead of a
// `file://...` URL, which makes `fileURLToPath` throw "The URL must be of
// scheme file"). Resolving the directory of *this* file first and handing
// that to plain `path.resolve` never matches that special-cased shape, so it
// sidesteps the rewrite entirely while still deriving everything from
// `import.meta.url` rather than assuming a relative cwd.
const LEVELS_PY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../backend/src/shared/levels.py",
);

/**
 * Extracts the ordered list of level-id string literals out of
 * `backend/src/shared/levels.py`'s `LEVEL_ORDER` tuple.
 *
 * Anchors on the actual assignment (`LEVEL_ORDER: tuple[str, ...] = (`),
 * deliberately not on the bare identifier `LEVEL_ORDER` -- that file's own
 * module docstring mentions the name `LEVEL_ORDER` in prose *before* the
 * real assignment appears. A parser that greedily matches the first
 * occurrence of the identifier and reads to the next `)` finds that prose
 * instead and comes back with nothing, which reads as "the lists differ"
 * rather than "the parser is broken."
 *
 * Throws if the anchor can't be found, or if there's no closing `)` after
 * it, rather than returning `[]` -- a drift guard that can silently end up
 * comparing an empty list is worse than no guard at all, because it's
 * green.
 */
function extractLevelOrderFromPython(source: string): string[] {
  const anchor = /LEVEL_ORDER\s*:\s*tuple\[str,\s*\.\.\.\]\s*=\s*\(/;
  const match = anchor.exec(source);
  if (!match) {
    throw new Error(
      `could not find a "LEVEL_ORDER: tuple[str, ...] = (" assignment in ` +
        `${LEVELS_PY_PATH} -- either the file moved, or its syntax changed ` +
        "enough that this test's anchor regex no longer matches it",
    );
  }

  const tupleStart = match.index + match[0].length;
  const tupleEnd = source.indexOf(")", tupleStart);
  if (tupleEnd === -1) {
    throw new Error(
      `found the LEVEL_ORDER assignment in ${LEVELS_PY_PATH} but no ` +
        "closing ')' after it",
    );
  }

  const tupleBody = source.slice(tupleStart, tupleEnd);
  return [...tupleBody.matchAll(/"([^"]*)"/g)].map((entry) => entry[1]);
}

describe("LEVEL_ORDER drift guard", () => {
  const pythonSource = readFileSync(LEVELS_PY_PATH, "utf-8");
  const pythonIds = extractLevelOrderFromPython(pythonSource);
  const frontendIds = levels.map((level) => level.id);

  it("parses a non-empty LEVEL_ORDER out of the python file", () => {
    // Checked before the content comparison, and against the frontend's own
    // real count rather than a hardcoded number, on purpose: this is what
    // turns a broken parser into an unambiguous failure of its own, instead
    // of a `toEqual` diff that just looks like the two lists disagree.
    expect(pythonIds.length).toBeGreaterThan(0);
    expect(pythonIds.length).toBe(frontendIds.length);
  });

  it("matches the frontend's canonical chain exactly, in order", () => {
    expect(pythonIds).toEqual(frontendIds);
  });
});
