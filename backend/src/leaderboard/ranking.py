"""Ranking the leaderboard -- the Python port of ranking.ts, removed along
with the rest of the TypeScript backend once this port finished (see git
history for it); the reasoning its comments recorded is carried forward
below.

LeaderboardEntry is the one shape in this backend that goes straight onto
the wire as-is: GET /api/leaderboard responds with `{"entries": [...]}`,
and frontend/src/engine/leaderboardClient.ts reads
displayName/entryPoint/levelId/reachedAt off each element. A plain
model_dump() would hand it snake_case keys the frontend does not know to
read -- and the page would not error, every name would just render blank.
Always serialise with `model_dump(by_alias=True)` (or
`model_dump_json(by_alias=True)`), never the bare form.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field

from src.leaderboard.schemas import EntryPoint

DEFAULT_LIMIT = 1000
MAX_LIMIT = 1000


@dataclass(frozen=True, slots=True)
class BestPassRow:
    """One player's furthest pass, as read out of the database. The Python
    port of ranking.ts's `BestPassRow` interface -- internal only, never
    serialised, so it carries no aliases.
    """

    display_name: str
    entry_point: EntryPoint
    depth: int
    level_id: str
    passed_at: datetime


class LeaderboardEntry(BaseModel):
    """One row of the public leaderboard. Deliberately carries no
    `profile_id` field at all -- the response is public, and handing out an
    identifier would let anyone replay it to inject progress under someone
    else's name.

    `populate_by_name=True` so rank_entries() below can build instances with
    ordinary snake_case keyword arguments; `by_alias=True` at serialisation
    time is what turns them back into the camelCase JSON the frontend
    expects. (ProgressRequest in schemas.py, by contrast, is only ever built
    *from* client JSON rather than constructed by our own code, so it has no
    matching need for populate_by_name and deliberately does without it.)
    """

    model_config = ConfigDict(populate_by_name=True)

    rank: int
    display_name: str = Field(alias="displayName")
    entry_point: EntryPoint = Field(alias="entryPoint")
    depth: int
    level_id: str = Field(alias="levelId")
    reached_at: str = Field(alias="reachedAt")


def parse_limit(raw: object) -> int:
    """Parse a `limit` query parameter: defaults to DEFAULT_LIMIT, clamps to
    [1, MAX_LIMIT]. The Python port of ranking.ts's `parseLimit`, kept
    deliberately tolerant of `raw` being nearly anything: on Vercel,
    `req.query.limit` could be a string, absent, or -- if the client repeats
    the query key -- an array of strings, and this had to default safely
    rather than throw for every one of those shapes. FastAPI's query-string
    plumbing does not reproduce that exact array shape, but the check is
    kept anyway: this function accepts arbitrary untrusted input by
    contract, and defaulting beats guessing.
    """
    if isinstance(raw, str):
        # Checked before the numeric parse deliberately: JavaScript's
        # `Number("")` and `Number("   ")` both coerce to 0, not NaN, which
        # would otherwise clamp a blank query param to 1 instead of
        # defaulting it to DEFAULT_LIMIT. Python's `float("")` merely raises
        # rather than silently returning 0, so this guard is not load-bearing
        # here the way it is in ranking.ts -- it is kept regardless so "blank
        # means absent" reads as the intentional rule it is, not as an
        # accident of what float() happens to reject.
        if raw.strip() == "":
            return DEFAULT_LIMIT
        try:
            value = float(raw)
        except ValueError:
            return DEFAULT_LIMIT
        if not math.isfinite(value):
            return DEFAULT_LIMIT
        return min(max(int(value), 1), MAX_LIMIT)

    # bool is a subclass of int in Python (isinstance(True, int) is True),
    # a quirk JavaScript's typeof has no equivalent of -- `typeof true` is
    # "boolean", never "number". Excluded explicitly so a stray boolean
    # cannot slip through and be truncated into 1 or 0.
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        if not math.isfinite(raw):
            return DEFAULT_LIMIT
        return min(max(int(raw), 1), MAX_LIMIT)

    return DEFAULT_LIMIT


def _to_iso8601(moment: datetime) -> str:
    """Render a datetime the way JavaScript's `Date.prototype.toISOString()`
    does: UTC, millisecond precision, a literal "Z" suffix. Python's own
    `datetime.isoformat()` is not a substitute for it -- by default it emits
    microseconds (or drops the fractional part entirely when it is zero) and
    a "+00:00" offset instead of "Z", which would change the value of every
    reachedAt on the wire. passed_at comes out of a `timestamptz` column
    (schema.sql), so it normally arrives timezone-aware already; a naive
    value is treated as already being UTC rather than rejected, since that
    is the only timezone this database ever writes.
    """
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    else:
        moment = moment.astimezone(timezone.utc)
    milliseconds = moment.microsecond // 1000
    return moment.strftime("%Y-%m-%dT%H:%M:%S") + f".{milliseconds:03d}Z"


def rank_entries(rows: Sequence[BestPassRow]) -> list[LeaderboardEntry]:
    """Sort by depth descending, then by passed_at ascending (deepest
    first; among equal depths, whoever arrived earliest) and number the
    result from 1. The Python port of ranking.ts's `rankEntries`.

    The SQL already returns rows in this order; sorting again here keeps
    rank assignment correct for any caller and makes the ordering rule
    testable without a database. Unlike JavaScript's in-place
    `Array.prototype.sort()`, Python's `sorted()` already returns a new list
    without touching its input, so -- unlike ranking.ts -- this needs no
    explicit defensive copy to leave the caller's sequence alone.
    """
    ordered = sorted(rows, key=lambda row: (-row.depth, row.passed_at))
    return [
        LeaderboardEntry(
            rank=index + 1,
            display_name=row.display_name,
            entry_point=row.entry_point,
            depth=row.depth,
            level_id=row.level_id,
            reached_at=_to_iso8601(row.passed_at),
        )
        for index, row in enumerate(ordered)
    ]
