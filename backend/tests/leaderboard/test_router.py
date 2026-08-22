"""Tests for src.leaderboard.router -- the Python port of the two Vercel
handlers routes/progress.ts and routes/list.ts (reached via
api/leaderboard/progress.ts and api/leaderboard/index.ts) -- all four
removed when the TypeScript backend was retired; see git history for them.

Mirrored backend/test/leaderboard/handlers.test.ts (also removed; see git
history), with src.leaderboard.queries mocked exactly like
handlers.test.ts's `vi.mock("../../src/leaderboard/queries")`
-- these are HTTP-boundary tests, not database tests, so no real Postgres
connection is ever opened. Uses FastAPI's TestClient against the *real*
`app` from src.app (not a reconstructed test-only app), so the CORS
middleware and the RequestValidationError -> 400 override are exercised
exactly as they would run in production.

Required coverage per the Task P3 brief, each with a comment on which test
below covers it:

- success (POST): TestPostProgress.test_stores_a_valid_pass_and_echoes_the_server_derived_depth
- unknown levelId -> 400: TestPostProgress.test_rejects_an_unknown_level_id_without_touching_the_database
- blank nickname -> 400: TestPostProgress.test_rejects_a_blank_nickname_without_touching_the_database
- limit clamped before it reaches the query: TestGetLeaderboard.test_clamps_an_absurd_limit_before_querying
- database exception -> 500 with no leaked message: TestPostProgress.test_returns_500_without_leaking_the_underlying_error
  and TestGetLeaderboard.test_returns_500_without_leaking_the_underlying_error
- response not containing profileId: TestGetLeaderboard.test_returns_ranked_entries_without_a_profile_id

A few extra tests beyond that required list are included where they pin
behaviour the brief calls load-bearing (the RequestValidationError override
actually firing, the exact route paths existing under /api) or where a
known, deliberate difference from the TypeScript needs to be documented
rather than silently left untested (the CORS preflight response shape).
"""

from datetime import datetime, timezone
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.leaderboard import queries
from src.leaderboard.ranking import DEFAULT_LIMIT, MAX_LIMIT
from src.leaderboard.schemas import ProgressInput

client = TestClient(app)

# raise_server_exceptions=False makes an unhandled exception inside the app
# surface as the real 500 response a production client would see, instead
# of propagating out of .post()/.get() and into this test process as a
# raw Python exception (which would look like a test error, not an
# application bug). Used only by TestValidationHandlerSurvivesNonJsonBodies
# below, which exists specifically to observe that boundary.
safe_client = TestClient(app, raise_server_exceptions=False)

VALID_BODY: dict[str, Any] = {
    "profileId": "3f2a4b6c-1111-2222-3333-444455556666",
    "displayName": "阿明",
    "entryPoint": "L1",
    "levelId": "L2-0",
}

# A fake exception carrying the exact kind of detail rule 5 warns about --
# host, port, and a credential -- so the "no leaked message" tests prove
# something a generic short string like Exception("boom") would not: that
# nothing about a real psycopg connection-failure message can reach the
# client, not merely that the literal words "internal error" happen to
# appear somewhere in the body.
FAKE_DB_ERROR = Exception(
    'connection to server at "ep-fake-cell-12345.us-east-2.aws.neon.tech" '
    'port=5432 failed: password authentication failed for user "dbuser"'
)


class TestPostProgress:
    def test_stores_a_valid_pass_and_echoes_the_server_derived_depth(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        response = client.post("/api/leaderboard/progress", json=VALID_BODY)

        assert response.status_code == 200
        assert response.json() == {"ok": True, "depth": 9}
        mock_record.assert_called_once_with(
            ProgressInput(
                profile_id=VALID_BODY["profileId"],
                display_name=VALID_BODY["displayName"],
                entry_point=VALID_BODY["entryPoint"],
                level_id=VALID_BODY["levelId"],
                depth=9,
            )
        )

    def test_rejects_an_unknown_level_id_without_touching_the_database(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        response = client.post(
            "/api/leaderboard/progress", json={**VALID_BODY, "levelId": "L9-99"}
        )

        assert response.status_code == 400
        mock_record.assert_not_called()

    def test_rejects_a_blank_nickname_without_touching_the_database(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        response = client.post(
            "/api/leaderboard/progress", json={**VALID_BODY, "displayName": "   "}
        )

        assert response.status_code == 400
        mock_record.assert_not_called()

    def test_returns_500_without_leaking_the_underlying_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(side_effect=FAKE_DB_ERROR)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        response = client.post("/api/leaderboard/progress", json=VALID_BODY)

        assert response.status_code == 500
        body_text = response.text
        assert "neon.tech" not in body_text
        assert "dbuser" not in body_text
        assert "password" not in body_text
        assert response.json() == {"ok": False, "error": "internal error"}

    def test_rejects_a_non_object_body_via_the_400_override_not_422(self) -> None:
        # No queries mock needed: a malformed body must never reach the
        # database layer at all. This is the one case in this file that
        # actually exercises FastAPI's own RequestValidationError path
        # (a JSON body that parses but isn't an object) rather than
        # schemas.parse_progress_body's -- proving the override in src.app
        # is wired up and not merely dead code the other 400 tests happen
        # not to need.
        response = client.post(
            "/api/leaderboard/progress",
            content=b'"nope"',
            headers={"content-type": "application/json"},
        )
        assert response.status_code == 400

    def test_refuses_a_get(self) -> None:
        response = client.get("/api/leaderboard/progress")
        assert response.status_code == 405

    def test_succeeds_even_when_event_start_is_malformed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The event date-range filter must affect GET /api/leaderboard
        only. POST never touches EVENT_START/EVENT_END or
        src.shared.event_window at all (see router.post_progress and
        queries.record_progress), so a typo'd deploy variable must not
        stop a real player's pass from being recorded mid-event.
        """
        monkeypatch.setenv("EVENT_START", "2026-08-22T09:00:00")  # no offset
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        response = client.post("/api/leaderboard/progress", json=VALID_BODY)

        assert response.status_code == 200
        assert response.json() == {"ok": True, "depth": 9}
        mock_record.assert_called_once()


class TestValidationHandlerSurvivesNonJsonBodies:
    """Fix round 1 regression coverage.

    A non-empty body sent with a Content-Type FastAPI does not treat as
    JSON (missing entirely, `text/plain`, or `application/x-www-form-urlencoded`)
    makes FastAPI raise RequestValidationError with the *raw request bytes*
    in each error dict's `input` field -- it never attempts to decode the
    body as JSON at all in this case, regardless of whether the bytes
    would actually have parsed. Before the fix, app.py's
    RequestValidationError handler passed `exc.errors()` -- bytes and
    all -- straight into JSONResponse, whose render() calls stdlib
    json.dumps() with no custom encoder. json.dumps() cannot serialise
    bytes, so the handler itself raised TypeError, which escaped FastAPI
    entirely and was answered by Starlette's outermost
    ServerErrorMiddleware as a bare-text 500 -- turning a 400-shaped input
    validation problem into a real, publicly triggerable server error on
    an unauthenticated endpoint.

    Every case here uses safe_client (raise_server_exceptions=False) so a
    regression shows up as the 500 it actually is, not as an exception
    thrown out of the test itself.
    """

    def test_no_content_type_header_returns_400_not_500(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        body = b"marker-blank-content-type: profileId=x&displayName=y"
        response = safe_client.post("/api/leaderboard/progress", content=body)

        assert response.status_code == 400
        assert response.headers["content-type"].startswith("application/json")
        assert response.json()  # decodes cleanly; a 500 body would not be JSON at all
        assert "marker-blank-content-type" not in response.text
        mock_record.assert_not_called()

    def test_text_plain_content_type_returns_400_not_500(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        body = b"marker-text-plain: this is not json at all"
        response = safe_client.post(
            "/api/leaderboard/progress",
            content=body,
            headers={"content-type": "text/plain"},
        )

        assert response.status_code == 400
        assert response.headers["content-type"].startswith("application/json")
        assert response.json()
        assert "marker-text-plain" not in response.text
        mock_record.assert_not_called()

    def test_form_urlencoded_content_type_returns_400_not_500(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        body = b"marker-form-urlencoded=1&profileId=x&displayName=y&entryPoint=L1&levelId=L2-0"
        response = safe_client.post(
            "/api/leaderboard/progress",
            content=body,
            headers={"content-type": "application/x-www-form-urlencoded"},
        )

        assert response.status_code == 400
        assert response.headers["content-type"].startswith("application/json")
        assert response.json()
        assert "marker-form-urlencoded" not in response.text
        mock_record.assert_not_called()


class TestGetLeaderboard:
    def test_returns_ranked_entries_without_a_profile_id(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.leaderboard.ranking import BestPassRow

        mock_fetch = Mock(
            return_value=[
                BestPassRow(
                    display_name="阿明",
                    entry_point="L1",
                    depth=9,
                    level_id="L2-0",
                    passed_at=datetime(2026, 8, 21, 10, 0, 0, tzinfo=timezone.utc),
                )
            ]
        )
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        body = response.json()
        assert body["entries"][0]["rank"] == 1
        assert "profileId" not in body["entries"][0]
        # Rule 6 is layered defence; the router test is the outermost layer
        # -- it checks the actual JSON bytes on the wire, not just that the
        # Pydantic model has no such field (already pinned in test_ranking.py).
        assert "profileId" not in response.text
        assert set(body["entries"][0]) == {
            "rank",
            "displayName",
            "entryPoint",
            "depth",
            "levelId",
            "reachedAt",
        }
        assert "updatedAt" in body

    def test_clamps_an_absurd_limit_before_querying(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard", params={"limit": "99999"})

        assert response.status_code == 200
        # start/end are the event date-range feature's bounds -- both None
        # here since neither EVENT_START/EVENT_END nor ?from=/?to= is set
        # (see TestGetLeaderboardDateWindow below for that feature's own
        # coverage); this test's own job is still just pinning the limit
        # clamp.
        mock_fetch.assert_called_once_with(MAX_LIMIT, start=None, end=None)

    def test_returns_500_without_leaking_the_underlying_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_fetch = Mock(side_effect=FAKE_DB_ERROR)
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 500
        body_text = response.text
        assert "neon.tech" not in body_text
        assert "dbuser" not in body_text
        assert "password" not in body_text
        # list.ts's catch block replies `{ error: "internal error" }` --
        # deliberately with no `ok` key, unlike progress.ts's `{ ok: false,
        # error: ... }`. That asymmetry is in the reviewed original, not a
        # bug to smooth over while porting, so it is pinned here rather
        # than silently normalised to match the other endpoint.
        assert response.json() == {"error": "internal error"}

    def test_refuses_a_post(self) -> None:
        response = client.post("/api/leaderboard")
        assert response.status_code == 405


class TestGetLeaderboardDateWindow:
    """The event date-range filter, as observed through GET
    /api/leaderboard's HTTP boundary: EVENT_START/EVENT_END env vars, the
    ?from=/?to= overrides, and their precedence. queries.fetch_best_passes
    is mocked here exactly like every other test in TestGetLeaderboard --
    these tests pin what the router computes and passes down, not the SQL
    itself (see test_queries.py for that, and
    tests/shared/test_event_window.py for the parsing/precedence rules in
    isolation from FastAPI).
    """

    def test_neither_env_var_set_passes_no_bounds_to_the_query_layer(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        mock_fetch.assert_called_once_with(DEFAULT_LIMIT, start=None, end=None)

    def test_only_event_start_set_passes_start_with_no_end(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_START", "2026-08-22T00:00:00+08:00")
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        mock_fetch.assert_called_once_with(
            DEFAULT_LIMIT,
            start=datetime.fromisoformat("2026-08-22T00:00:00+08:00"),
            end=None,
        )

    def test_only_event_end_set_passes_end_with_no_start(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_END", "2026-08-23T00:00:00+08:00")
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        mock_fetch.assert_called_once_with(
            DEFAULT_LIMIT,
            start=None,
            end=datetime.fromisoformat("2026-08-23T00:00:00+08:00"),
        )

    def test_both_env_vars_set_passes_both_bounds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_START", "2026-08-22T00:00:00+08:00")
        monkeypatch.setenv("EVENT_END", "2026-08-23T00:00:00+08:00")
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 200
        mock_fetch.assert_called_once_with(
            DEFAULT_LIMIT,
            start=datetime.fromisoformat("2026-08-22T00:00:00+08:00"),
            end=datetime.fromisoformat("2026-08-23T00:00:00+08:00"),
        )

    def test_query_from_overrides_event_start_while_event_end_still_applies(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_START", "2020-01-01T00:00:00+08:00")
        monkeypatch.setenv("EVENT_END", "2026-08-23T00:00:00+08:00")
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get(
            "/api/leaderboard", params={"from": "2026-08-22T12:00:00+08:00"}
        )

        assert response.status_code == 200
        mock_fetch.assert_called_once_with(
            DEFAULT_LIMIT,
            start=datetime.fromisoformat("2026-08-22T12:00:00+08:00"),
            end=datetime.fromisoformat("2026-08-23T00:00:00+08:00"),
        )

    def test_offset_less_query_from_is_rejected_with_400(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get(
            "/api/leaderboard", params={"from": "2026-08-22T09:00:00"}
        )

        assert response.status_code == 400
        assert response.json()["ok"] is False
        mock_fetch.assert_not_called()

    def test_offset_less_query_to_is_rejected_with_400(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get(
            "/api/leaderboard", params={"to": "2026-08-22T09:00:00"}
        )

        assert response.status_code == 400
        assert response.json()["ok"] is False
        mock_fetch.assert_not_called()

    def test_offset_less_event_start_returns_500_without_leaking_the_value(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_START", "2026-08-22T09:00:00")  # no offset
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 500
        # Same generic body as every other 500 on this endpoint (rule 4:
        # "the existing generic 500", not a bespoke one) -- and unlike the
        # server-side log, it never contains the offending value.
        assert response.json() == {"error": "internal error"}
        assert "2026-08-22T09:00:00" not in response.text
        mock_fetch.assert_not_called()

    def test_offset_less_event_end_returns_500_without_leaking_the_value(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("EVENT_END", "2026-08-22T09:00:00")  # no offset
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get("/api/leaderboard")

        assert response.status_code == 500
        assert response.json() == {"error": "internal error"}
        assert "2026-08-22T09:00:00" not in response.text
        mock_fetch.assert_not_called()

    def test_malformed_event_start_overridden_by_query_from_does_not_fail(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Bonus: pins the deliberate "override replaces outright" design
        in event_window.resolve_event_window -- a malformed EVENT_START
        that a request overrides via ?from= is never even read, so it
        cannot turn that request into a 500.
        """
        monkeypatch.setenv("EVENT_START", "not-a-timestamp-at-all")
        mock_fetch = Mock(return_value=[])
        monkeypatch.setattr(queries, "fetch_best_passes", mock_fetch)

        response = client.get(
            "/api/leaderboard", params={"from": "2026-08-22T12:00:00+08:00"}
        )

        assert response.status_code == 200
        mock_fetch.assert_called_once_with(
            DEFAULT_LIMIT,
            start=datetime.fromisoformat("2026-08-22T12:00:00+08:00"),
            end=None,
        )


class TestExactRoutePaths:
    """Rule 7: Vercel rewrites all of /api/* to one entry point, so the
    paths FastAPI dispatches on must carry the full /api prefix themselves
    -- a router mounted under some other prefix would 404 on every real
    request despite passing tests that call it directly as an ASGI app
    under a different path. Checked directly against the app's own
    generated OpenAPI schema rather than only indirectly through the
    request tests above, so a future refactor that renames a path breaks
    loudly here. (Not walked via app.routes: this FastAPI version does not
    flatten an included APIRouter's routes into that list -- it appears as
    one opaque `_IncludedRouter` entry -- so the schema is also the more
    stable introspection point across versions, not just the more direct
    one.)
    """

    def test_registers_exactly_the_two_leaderboard_paths_under_api(self) -> None:
        schema = app.openapi()
        leaderboard_paths = {
            path: set(methods)
            for path, methods in schema["paths"].items()
            if "leaderboard" in path
        }
        assert leaderboard_paths == {
            "/api/leaderboard/progress": {"post"},
            "/api/leaderboard": {"get"},
        }


class TestCors:
    """CORS reasoning moves from http.ts's hand-written handleCorsAndMethod
    into FastAPI's CORSMiddleware (see src/app.py). The middleware's
    preflight response is NOT byte-for-byte identical to the TypeScript
    version -- documented here rather than left silently unverified, since
    an untested behaviour change is exactly what this suite exists to
    catch. handlers.test.ts asserted 204 with an empty body; Starlette's
    CORSMiddleware answers preflights with 200 and a small text body
    instead. Both are valid 2xx preflight responses as far as a browser's
    CORS algorithm is concerned (it checks status and headers, not body),
    so this is a genuine but harmless difference, not a regression.
    """

    def test_actual_get_request_carries_the_wildcard_origin_header(self) -> None:
        response = client.get(
            "/api/leaderboard", headers={"Origin": "https://example.com"}
        )
        assert response.headers["access-control-allow-origin"] == "*"

    def test_preflight_is_answered_without_reaching_the_database(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_record = Mock(return_value=None)
        monkeypatch.setattr(queries, "record_progress", mock_record)

        response = client.options(
            "/api/leaderboard/progress",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "POST",
            },
        )

        assert response.status_code < 300
        assert response.headers["access-control-allow-origin"] == "*"
        mock_record.assert_not_called()
