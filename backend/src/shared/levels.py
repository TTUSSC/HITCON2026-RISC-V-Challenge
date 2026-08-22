"""The canonical 23-level chain, mirroring frontend/src/engine/levels.ts's
`levels` array order. A player's leaderboard score is the 1-based position
of the furthest level they have passed -- which is what makes the three
entry points comparable without any hand-tuned weighting: L2-0 sits at
position 9, so an L2 entrant who clears it ties an L0 entrant who ground
through eight levels to reach the same place.

This list is duplicated rather than imported because frontend and backend
deploy as separate Vercel projects. It used to also be a cross-language
duplication problem in one direction only: the old TypeScript backend could
still afford a drift guard that imported the frontend's module directly
(backend/test/shared/levelOrder.drift.test.ts) and compared arrays at test
time. A Python file cannot import a .ts module, so that trick doesn't
survive the port. Rather than drop the guard, its direction is reversed:
frontend/src/engine/levels.drift.test.ts reads *this* file as text, pulls
the LEVEL_ORDER string literals out of it, and diffs them against its own
real `import` of levels.ts. Edit the list below and, if the two ever
disagree, it is the frontend test that goes red.

One more thing TypeScript had that Python doesn't: `levels.ts` also exports
a `LevelId` type -- the literal union of these 23 strings, derived from the
array at compile time -- so misspelled level ids elsewhere are a type error
before the code ever runs. Python has no built-in way to derive a static
type from a runtime tuple like that without hand-maintaining a second,
parallel list of literals (which would just be one more place for this list
to drift from). So there is no `LevelId` here; callers that need to know
whether a string is a real level id call `depth_for_level` and check for
`None`, which is a runtime check standing in for what TypeScript catches at
compile time.
"""

LEVEL_ORDER: tuple[str, ...] = (
    "L0-1",
    "L0-2",
    "L0-3",
    "L0-4",
    "L1-1",
    "L1-2",
    "L1-3",
    "L1-4",
    "L2-0",
    "L2-1",
    "L2-2",
    "L2-3",
    "L2-4",
    "L2-5a",
    "L2-5b",
    "L2-5c",
    "L2-Bonus",
    "L3-0",
    "L3-1",
    "L3-2",
    "L3-3",
    "L3-4",
    "L3-Bonus",
)

MAX_DEPTH: int = len(LEVEL_ORDER)


def depth_for_level(level_id: str) -> int | None:
    """1-based position in the chain; ``None`` for an unknown level id."""
    try:
        return LEVEL_ORDER.index(level_id) + 1
    except ValueError:
        return None
