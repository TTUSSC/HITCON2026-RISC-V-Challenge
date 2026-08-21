"""Tests for src.leaderboard.ranking -- the Python port of ranking.ts.

Mirrors backend/test/leaderboard/ranking.test.ts case-for-case (12 cases: 5
for parse_limit, 7 for rank_entries), plus checks that only make sense in
the Python port: that LeaderboardEntry actually serialises to the
frontend's camelCase field names, and that a Python `bool` (a subtype of
`int`) is not mistaken for a numeric limit. See ranking.py's docstrings for
why each rule exists.
"""

from dataclasses import replace
from datetime import datetime, timezone

from src.leaderboard.ranking import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    BestPassRow,
    LeaderboardEntry,
    parse_limit,
    rank_entries,
)


def make_row(**overrides: object) -> BestPassRow:
    base = BestPassRow(
        display_name="player",
        entry_point="L0",
        depth=5,
        level_id="L1-1",
        passed_at=datetime(2026, 8, 21, 10, 0, 0, tzinfo=timezone.utc),
    )
    return replace(base, **overrides)  # type: ignore[arg-type]


class TestParseLimit:
    def test_defaults_when_the_value_is_absent_or_unparseable(self) -> None:
        assert parse_limit(None) == DEFAULT_LIMIT
        assert parse_limit("abc") == DEFAULT_LIMIT

    def test_defaults_for_empty_or_whitespace_only_strings(self) -> None:
        assert parse_limit("") == DEFAULT_LIMIT
        assert parse_limit("  ") == DEFAULT_LIMIT

    def test_accepts_a_numeric_string_from_the_query_string(self) -> None:
        assert parse_limit("10") == 10

    def test_clamps_to_the_allowed_range(self) -> None:
        assert parse_limit("0") == 1
        assert parse_limit("99999") == MAX_LIMIT

    def test_defaults_when_given_a_list_query_string_repetition(self) -> None:
        assert parse_limit(["1", "2"]) == DEFAULT_LIMIT

    def test_does_not_treat_a_bool_as_a_number(self) -> None:
        # bool is a subclass of int in Python (isinstance(True, int) is
        # True), unlike JavaScript where `typeof true` is "boolean", never
        # "number" -- parse_limit(True) must not silently become 1.
        assert parse_limit(True) == DEFAULT_LIMIT
        assert parse_limit(False) == DEFAULT_LIMIT


class TestRankEntries:
    def test_orders_by_depth_deepest_first(self) -> None:
        ranked = rank_entries(
            [
                make_row(display_name="shallow", depth=3),
                make_row(display_name="deep", depth=20),
                make_row(display_name="middle", depth=9),
            ]
        )
        assert [e.display_name for e in ranked] == ["deep", "middle", "shallow"]

    def test_breaks_a_depth_tie_in_favour_of_whoever_got_there_first(self) -> None:
        ranked = rank_entries(
            [
                make_row(
                    display_name="later",
                    depth=9,
                    passed_at=datetime(2026, 8, 21, 12, 0, 0, tzinfo=timezone.utc),
                ),
                make_row(
                    display_name="earlier",
                    depth=9,
                    passed_at=datetime(2026, 8, 21, 9, 0, 0, tzinfo=timezone.utc),
                ),
            ]
        )
        assert [e.display_name for e in ranked] == ["earlier", "later"]

    def test_numbers_ranks_from_1(self) -> None:
        ranked = rank_entries([make_row(depth=9), make_row(depth=3)])
        assert [e.rank for e in ranked] == [1, 2]

    def test_serialises_the_timestamp_as_iso_8601(self) -> None:
        [entry] = rank_entries([make_row()])
        assert entry.reached_at == "2026-08-21T10:00:00.000Z"

    def test_never_leaks_a_profile_id_into_the_response(self) -> None:
        # Structurally impossible, not merely absent by luck: the field
        # does not exist on the model at all, so there is nothing a future
        # change to rank_entries() could accidentally start populating.
        assert "profile_id" not in LeaderboardEntry.model_fields
        [entry] = rank_entries([make_row()])
        assert "profileId" not in entry.model_dump(by_alias=True)

    def test_returns_an_empty_list_for_no_rows(self) -> None:
        assert rank_entries([]) == []

    def test_does_not_mutate_the_callers_list(self) -> None:
        rows = [make_row(depth=3), make_row(depth=9)]
        rank_entries(rows)
        assert [r.depth for r in rows] == [3, 9]


class TestLeaderboardEntrySerialisesCamelCase:
    """Rule 1's other direction: GET /api/leaderboard's response goes
    straight onto the wire, so every key rank_entries() produces has to
    survive `model_dump(by_alias=True)` as camelCase, or the frontend reads
    `undefined` for every field -- silently, since JavaScript does not
    error on a missing object property, it just renders blank names.
    """

    def test_model_dump_by_alias_uses_the_frontends_field_names(self) -> None:
        [entry] = rank_entries([make_row()])
        dumped = entry.model_dump(by_alias=True)
        assert set(dumped) == {
            "rank",
            "displayName",
            "entryPoint",
            "depth",
            "levelId",
            "reachedAt",
        }

    def test_plain_model_dump_without_by_alias_is_snake_case(self) -> None:
        # Documents the footgun directly: calling the wrong dump method is
        # the one mistake that would silently break the frontend without
        # any test here failing -- a router test (Task P3) is what actually
        # exercises the JSON bytes the client receives.
        [entry] = rank_entries([make_row()])
        assert "display_name" in entry.model_dump()
