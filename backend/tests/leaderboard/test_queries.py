"""Tests for src.leaderboard.queries.fetch_best_passes's date-window
predicate construction (the event date-range filter).

These fake the DB connection entirely and inspect the exact SQL text and
parameter tuple handed to conn.execute() -- the same "HTTP/DB-boundary"
testing philosophy test_router.py already documents for itself ("these are
HTTP-boundary tests ... no real Postgres connection is ever opened"): no
real Postgres connection is opened here either, and that is a deliberate
choice, not a shortcut. The property rule 1 protects (a date predicate
applied outside the `distinct on` CTE silently drops an in-range player
whose all-time deepest pass happens to be out of range) is a property of
the SQL TEXT's clause placement, fully checkable by string inspection. The
property rule 5 names (the interval is half-open) is a property of which
comparison OPERATOR the query sends to Postgres (`>=` vs strict `<`, never
`<=`) -- Postgres itself is trusted to honour whichever operator it
receives, exactly as test_router.py already trusts FastAPI/Starlette's own
routing rather than re-testing it.
"""

from datetime import datetime, timezone
from typing import Any

import pytest

from src.leaderboard import queries


class _FakeConnection:
    """Stands in for the object get_connection() would normally hand back:
    records exactly what fetch_best_passes sends to .execute() and returns
    canned rows from .fetchall(), the way a real connection would after a
    real query -- minus an actual database on the other end. Supports the
    `with get_connection() as conn:` context-manager usage queries.py
    relies on.
    """

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self.sql: str | None = None
        self.params: tuple[object, ...] | None = None

    def __enter__(self) -> "_FakeConnection":
        return self

    def __exit__(self, *exc_info: object) -> bool:
        return False

    def execute(self, sql: str, params: tuple[object, ...]) -> "_FakeConnection":
        self.sql = sql
        self.params = params
        return self

    def fetchall(self) -> list[dict[str, Any]]:
        return self._rows


_ROW: dict[str, Any] = {
    "display_name": "阿明",
    "entry_point": "L1",
    "depth": 9,
    "level_id": "L2-0",
    "passed_at": datetime(2026, 8, 22, 1, 0, 0, tzinfo=timezone.utc),
}


def _install_fake(
    monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, Any]]
) -> _FakeConnection:
    fake = _FakeConnection(rows)
    monkeypatch.setattr(queries, "get_connection", lambda: fake)
    return fake


def _assert_predicate_inside_cte(sql: str, predicate: str) -> None:
    """Assert `predicate` appears within the `from passes` ... `)` span
    that closes the `with best as (...)` CTE -- i.e. before `distinct on`
    ever runs -- rather than after the CTE closes. Rule 1: a predicate
    placed on the outer query (after the join) would filter each player's
    single already-chosen ALL-TIME deepest pass, instead of choosing their
    deepest pass FROM WITHIN the range -- which silently drops an in-range
    player whenever their all-time deepest pass happens to be from a
    previous event. No error either way, which is exactly why this needs
    to be a structural assertion and not just a "the row count looks
    right" check.
    """
    cte_start = sql.index("from passes")
    outer_select = sql.index("select p.display_name")
    cte_body = sql[cte_start:outer_select]
    assert predicate in cte_body, (
        f"expected {predicate!r} inside the CTE body, got: {cte_body!r}"
    )


class TestFetchBestPassesDateWindow:
    def test_no_bounds_leaves_the_sql_byte_for_byte_unchanged(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = _install_fake(monkeypatch, [_ROW, _ROW])

        result = queries.fetch_best_passes(500)

        assert fake.sql == queries._FETCH_BEST_PASSES_SQL
        assert "where" not in fake.sql.lower()
        assert fake.params == (500,)
        assert len(result) == 2  # every row handed back, none dropped

    def test_start_only_filters_inside_the_cte_with_gte(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = _install_fake(monkeypatch, [])
        start = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

        queries.fetch_best_passes(500, start=start, end=None)

        assert fake.params == (start, 500)
        _assert_predicate_inside_cte(fake.sql, "passed_at >= %s")

    def test_end_only_filters_inside_the_cte_with_strict_lt(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = _install_fake(monkeypatch, [])
        end = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)

        queries.fetch_best_passes(500, start=None, end=end)

        assert fake.params == (end, 500)
        _assert_predicate_inside_cte(fake.sql, "passed_at < %s")
        assert "passed_at <= %s" not in fake.sql

    def test_both_bounds_filter_inside_the_cte_params_ordered_start_then_end(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = _install_fake(monkeypatch, [])
        start = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)

        queries.fetch_best_passes(500, start=start, end=end)

        assert fake.params == (start, end, 500)
        _assert_predicate_inside_cte(fake.sql, "passed_at >= %s and passed_at < %s")

    def test_limit_still_travels_as_the_final_parameter_never_interpolated(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = _install_fake(monkeypatch, [])
        start = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

        queries.fetch_best_passes(42, start=start, end=None)

        assert "42" not in fake.sql
        assert fake.sql.rstrip().endswith("limit %s")
        assert fake.params[-1] == 42
