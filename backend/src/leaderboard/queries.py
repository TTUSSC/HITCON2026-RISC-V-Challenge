"""SQL for the leaderboard feature -- the Python port of queries.ts. Read
that file's comments before touching this one; the reasoning below is
carried over, not reinvented.

Both statements are copied verbatim from queries.ts (parameter placeholders
translated from neon's tagged-template `${...}` interpolation to psycopg's
`%s` style; nothing about the SQL itself -- clause order, join, `distinct
on`, `on conflict` targets -- is rewritten). The `distinct on (profile_id)`
query especially was verified line by line in review: flip either `desc` to
`asc` and it silently returns everyone's SHALLOWEST pass instead of their
deepest -- no error, no failing test without real data in the table.
"""

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


def fetch_best_passes(limit: int) -> list[BestPassRow]:
    """Each player's deepest pass, ranked. The Python port of queries.ts's
    `fetchBestPasses`. `limit` is parameterised like every other value here
    -- never string-interpolated into the SQL -- even though by the time it
    arrives it has already been through ranking.parse_limit() and is
    guaranteed to be a plain clamped int; parameterising it anyway is
    defence in depth that costs nothing.
    """
    with get_connection() as conn:
        rows = conn.execute(_FETCH_BEST_PASSES_SQL, (limit,)).fetchall()

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
