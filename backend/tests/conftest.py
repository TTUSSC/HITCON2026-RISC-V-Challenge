"""Test-suite-wide fixtures.

Currently just one: EVENT_START/EVENT_END (src/shared/event_window.py,
the event date-range feature) are cleared before every test in this
suite, regardless of which package it lives in, so a value in whatever
shell happens to be running pytest never leaks into a test that isn't
specifically about it -- and so a test that DOES set one of them always
starts from a known-empty baseline rather than layering on top of
whatever a previous test left behind. monkeypatch undoes the clearing (a
no-op if the var was never set) automatically after each test either way,
so tests that need a value just monkeypatch.setenv it themselves.
"""

import pytest


@pytest.fixture(autouse=True)
def _clear_event_window_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EVENT_START", raising=False)
    monkeypatch.delenv("EVENT_END", raising=False)
