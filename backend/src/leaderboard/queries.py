"""SQL for the leaderboard feature -- the Python port of queries.ts, removed
along with the rest of the TypeScript backend once this port finished (see
git history for it); the reasoning below is carried over, not reinvented.

Both statements are copied verbatim from queries.ts (parameter placeholders
translated from neon's tagged-template `${...}` interpolation to psycopg's
`%s` style; nothing about the SQL itself -- clause order, join, `distinct
on`, `on conflict` targets -- is rewritten). The `distinct on (profile_id)`
query especially was verified line by line in review: flip either `desc` to
`asc` and it silently returns everyone's SHALLOWEST pass instead of their
deepest -- no error, no failing test without real data in the table.
"""

from datetime import datetime
from typing import cast

from src.leaderboard.ranking import BestPassRow
from src.leaderboard.schemas import EntryPoint, ProgressInput
from src.shared.db import get_connection

_UPSERT_PLAYER_SQL = """
    insert into players (profile_id, display_name, entry_point)
    values (%s, %s, %s)
    on conflict (profile_id) do update
      set display_name = excluded.display_name,
          entry_point  = excluded.entry_point,
          updated_at   = now()
"""

# No column is worth updating on a replay: depth is a function of level_id,
# and passed_at must keep the FIRST clear time because it is the
# leaderboard's tie-breaker. `do nothing` makes that guarantee structural
# rather than a matter of which columns happen to be in a SET list.
_INSERT_PASS_SQL = """
    insert into passes (profile_id, level_id, depth)
    values (%s, %s, %s)
    on conflict (profile_id, level_id) do nothing
"""


def record_progress(data: ProgressInput) -> None:
    """Upsert the player, then record the pass. The Python port of
    queries.ts's `recordProgress`.

    The two statements are committed independently and on purpose -- each
    right after it runs, not both together when the connection is closed --
    mirroring queries.ts, where each `sql` tagged-template call is its own
    independent HTTP request with no shared transaction. The foreign key
    forces player-then-pass ordering, and if the second statement fails the
    worst outcome is a player row with no passes, which the leaderboard's
    inner join simply does not return. Nothing is left visibly
    inconsistent. Wrapping both in one transaction here (the easy default
    for a session-oriented driver like psycopg, unlike neon's stateless
    HTTP one) would change that: a failure in the second statement would
    roll back the first, silently narrowing the set of players who show up
    at all.
    """
    with get_connection() as conn:
        conn.execute(
            _UPSERT_PLAYER_SQL,
            (data.profile_id, data.display_name, data.entry_point),
        )
        conn.commit()
        conn.execute(
            _INSERT_PASS_SQL,
            (data.profile_id, data.level_id, data.depth),
        )
        conn.commit()


# `distinct on (profile_id)` with a matching `order by` picks each player's
# deepest pass -- and, among equally deep passes, the earliest one. No
# denormalised best_depth column to drift out of sync. The outer `select`
# never names profile_id -- it is only used inside `using (profile_id)` to
# join -- which is one of three independent layers keeping a player
# identifier out of the public response (see rank_entries() in ranking.py
# and LeaderboardEntry's field list for the other two).
#
# This is the query with NEITHER date bound applied -- kept as its own
# untouched literal, rather than derived from the templated version below
# with an empty predicate list, so "the deployment gets reused across
# events" (src/shared/event_window.py) has a structural guarantee that
# leaving EVENT_START/EVENT_END unset reproduces this exact string, rather
# than a guarantee that merely happens to hold because the template's empty
# case was built carefully. See the templated version's docstring for why
# a date predicate, when one is added, MUST land inside this CTE rather
# than on the query below it.
_FETCH_BEST_PASSES_SQL = """
    with best as (
      select distinct on (profile_id)
             profile_id, depth, level_id, passed_at
      from passes
      order by profile_id, depth desc, passed_at asc
    )
    select p.display_name, p.entry_point, b.depth, b.level_id, b.passed_at
    from best b
    join players p using (profile_id)
    order by b.depth desc, b.passed_at asc
    limit %s
"""


def _fetch_best_passes_sql(*, has_start: bool, has_end: bool) -> str:
    """Build the query text for fetch_best_passes, with a `passed_at`
    predicate added inside the `best` CTE for each bound that is present --
    never on the outer query. Returns _FETCH_BEST_PASSES_SQL completely
    unchanged when neither bound is present (see that constant's comment).

    The predicate has to live INSIDE the CTE, before `distinct on` runs,
    not after it. `distinct on (profile_id)` picks each player's deepest
    pass FIRST; a predicate added to the outer query would then discard
    that already-chosen row for being out of range, which removes the
    player from the board entirely even when they have a different, earlier
    pass that IS in range. Filtering inside the CTE instead makes `distinct
    on` pick each player's deepest pass FROM WITHIN the range to begin
    with, which is what "this event's leaderboard" means. Both versions
    execute without error and without a failing test unless the underlying
    data actually straddles the boundary -- this is a clause-placement bug,
    not a syntax one, so only reasoning (and test_queries.py's structural
    assertions) catches it, not the database.

    The interval is half-open -- `passed_at >= start and passed_at < end`
    -- so EVENT_END names the first EXCLUDED instant rather than the last
    included one. `EVENT_END=2026-08-23T00:00:00+08:00` means "through the
    end of 22 August", full stop, with no separate argument to be had about
    whether `22 August 23:59:59.999` counts: it is simply everything before
    the 23rd begins in that offset.
    """
    if not has_start and not has_end:
        return _FETCH_BEST_PASSES_SQL

    conditions = []
    if has_start:
        conditions.append("passed_at >= %s")
    if has_end:
        conditions.append("passed_at < %s")
    where_clause = "      where " + " and ".join(conditions) + "\n"

    return f"""
    with best as (
      select distinct on (profile_id)
             profile_id, depth, level_id, passed_at
      from passes
{where_clause}      order by profile_id, depth desc, passed_at asc
    )
    select p.display_name, p.entry_point, b.depth, b.level_id, b.passed_at
    from best b
    join players p using (profile_id)
    order by b.depth desc, b.passed_at asc
    limit %s
"""


def fetch_best_passes(
    limit: int, *, start: datetime | None = None, end: datetime | None = None
) -> list[BestPassRow]:
    """Each player's deepest pass within [start, end), ranked. The Python
    port of queries.ts's `fetchBestPasses`, extended with the event
    date-range filter -- `start`/`end` are the already-resolved bounds from
    src.shared.event_window.resolve_event_window (see router.py), each
    independently optional; either or both being None means no bound on
    that side, reproducing the original unfiltered query exactly (see
    _FETCH_BEST_PASSES_SQL above).

    `limit`, `start` and `end` are all parameterised like every other value
    here -- never string-interpolated into the SQL, only their PRESENCE
    (not their value) changes which predicate text is generated. `limit`
    stays parameterised even though it has already been through
    ranking.parse_limit() and is guaranteed to be a plain clamped int;
    parameterising it anyway is defence in depth that costs nothing.
    """
    sql = _fetch_best_passes_sql(has_start=start is not None, has_end=end is not None)
    params: list[object] = []
    if start is not None:
        params.append(start)
    if end is not None:
        params.append(end)
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

    # psycopg's row_factory=dict_row (see db.get_connection) already hands
    # back a `timestamptz` column as a timezone-aware datetime, unlike the
    # neon HTTP driver's rows.map(...), which has to wrap
    # `new Date(String(row.passed_at))` around a value that arrived as
    # text over HTTP. There is no string to re-parse here.
    return [
        BestPassRow(
            display_name=str(row["display_name"]),
            entry_point=cast(EntryPoint, str(row["entry_point"])),
            depth=int(row["depth"]),
            level_id=str(row["level_id"]),
            passed_at=row["passed_at"],
        )
        for row in rows
    ]
