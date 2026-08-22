"""Tests for src.shared.event_window: the EVENT_START/EVENT_END reader and
the strict-offset timestamp parser it shares with the ?from=/?to= query
parameters (see src/leaderboard/router.py). These are unit tests against
the shared module directly, independent of FastAPI or the database --
src/leaderboard/tests/test_router.py separately pins the HTTP-boundary
behaviour (status codes, precedence as observed through a real request),
and src/leaderboard/tests/test_queries.py separately pins the SQL this
module's output eventually parameterises.

conftest.py's autouse fixture clears EVENT_START/EVENT_END before every
test here too, so "not set" is the default every test starts from unless
it calls monkeypatch.setenv itself.
"""

from datetime import datetime, timedelta, timezone

import pytest

from src.shared.event_window import (
    OffsetTimestampError,
    parse_offset_timestamp,
    parse_optional_bound,
    resolve_event_window,
)


class TestParseOffsetTimestamp:
    def test_accepts_a_timestamp_with_an_explicit_positive_offset(self) -> None:
        moment = parse_offset_timestamp("2026-08-22T09:00:00+08:00")

        assert moment == datetime(2026, 8, 22, 9, 0, 0, tzinfo=timezone(timedelta(hours=8)))
        assert moment.utcoffset() == timedelta(hours=8)

    def test_rejects_the_same_timestamp_with_the_offset_stripped_off(self) -> None:
        # This is rule 3's whole point: the booth is UTC+8 and the database
        # is UTC, so silently treating this as UTC would shift the window
        # by 8 hours -- excluding the entire first morning of the event
        # while the board still looks normal, just emptier. Reject rather
        # than guess.
        with pytest.raises(OffsetTimestampError):
            parse_offset_timestamp("2026-08-22T09:00:00")

    def test_rejects_a_string_that_is_not_a_timestamp_at_all(self) -> None:
        with pytest.raises(OffsetTimestampError):
            parse_offset_timestamp("not-a-timestamp-at-all")

    def test_accepts_a_zulu_suffix_as_an_explicit_utc_offset(self) -> None:
        # "Z" names zero offset explicitly -- the author wrote it, nothing
        # was assumed on their behalf -- so it satisfies rule 3 exactly as
        # "+00:00" would.
        moment = parse_offset_timestamp("2026-08-22T09:00:00Z")

        assert moment.utcoffset() == timedelta(0)


class TestParseOptionalBound:
    def test_none_means_not_provided(self) -> None:
        assert parse_optional_bound(None) is None

    def test_blank_string_means_not_provided(self) -> None:
        # Mirrors ranking.parse_limit's "blank means absent" rule -- see
        # that function's docstring for why this is a deliberate reading
        # rather than an accident.
        assert parse_optional_bound("") is None
        assert parse_optional_bound("   ") is None

    def test_a_real_value_is_parsed_strictly(self) -> None:
        moment = parse_optional_bound("2026-08-22T09:00:00+08:00")

        assert moment == datetime(2026, 8, 22, 9, 0, 0, tzinfo=timezone(timedelta(hours=8)))

    def test_an_offset_less_value_still_raises(self) -> None:
        with pytest.raises(OffsetTimestampError):
            parse_optional_bound("2026-08-22T09:00:00")


class TestResolveEventWindow:
    def test_neither_env_var_set_and_no_overrides_yields_no_filtering(self) -> None:
        # conftest.py's autouse fixture already clears both env vars; no
        # monkeypatch call needed in this one test.
        start, end = resolve_event_window(override_start=None, override_end=None)

        assert (start, end) == (None, None)

    def test_only_event_start_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("EVENT_START", "2026-08-22T00:00:00+08:00")

        start, end = resolve_event_window(override_start=None, override_end=None)

        assert start == datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone(timedelta(hours=8)))
        assert end is None

    def test_only_event_end_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("EVENT_END", "2026-08-23T00:00:00+08:00")

        start, end = resolve_event_window(override_start=None, override_end=None)

        assert start is None
        assert end == datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone(timedelta(hours=8)))

    def test_both_env_vars_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("EVENT_START", "2026-08-22T00:00:00+08:00")
        monkeypatch.setenv("EVENT_END", "2026-08-23T00:00:00+08:00")

        start, end = resolve_event_window(override_start=None, override_end=None)

        assert start == datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone(timedelta(hours=8)))
        assert end == datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone(timedelta(hours=8)))

    def test_override_replaces_event_start_entirely(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_START", "2020-01-01T00:00:00+08:00")
        override = datetime(2026, 8, 22, 12, 0, 0, tzinfo=timezone.utc)

        start, end = resolve_event_window(override_start=override, override_end=None)

        assert start == override

    def test_override_end_leaves_event_start_in_effect(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # The two bounds are independent: supplying only one override must
        # not disturb the other bound's env-var source.
        monkeypatch.setenv("EVENT_START", "2026-08-22T00:00:00+08:00")
        monkeypatch.setenv("EVENT_END", "2020-01-01T00:00:00+08:00")
        override_end = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)

        start, end = resolve_event_window(override_start=None, override_end=override_end)

        assert start == datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone(timedelta(hours=8)))
        assert end == override_end

    def test_malformed_event_start_raises_when_not_overridden(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_START", "2026-08-22T09:00:00")  # no offset

        with pytest.raises(OffsetTimestampError) as excinfo:
            resolve_event_window(override_start=None, override_end=None)

        # The exception message is what reaches server-side logs (see
        # router.get_leaderboard's generic except -> logger.exception) and
        # is expected to name the offending variable for whoever has to
        # fix the deploy config. It must never be echoed to a client --
        # that boundary is enforced in router.py/test_router.py, not here.
        assert "EVENT_START" in str(excinfo.value)

    def test_malformed_event_start_is_never_even_read_when_overridden(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # A supplied override is a full replacement, not a merge: the env
        # var it replaces is not consulted at all, so a stale typo in an
        # env var that every request already overrides can never break
        # anything.
        monkeypatch.setenv("EVENT_START", "not-a-timestamp-at-all")
        override = datetime(2026, 8, 22, 12, 0, 0, tzinfo=timezone.utc)

        start, end = resolve_event_window(override_start=override, override_end=None)

        assert start == override
