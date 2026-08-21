"""Tests for src.leaderboard.router -- the Python port of the two Vercel
handlers routes/progress.ts and routes/list.ts (reached via
api/leaderboard/progress.ts and api/leaderboard/index.ts).

Mirrors backend/test/leaderboard/handlers.test.ts, with src.leaderboard.queries
mocked exactly like handlers.test.ts's `vi.mock("../../src/leaderboard/queries")`
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

from typing import Any
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from src.app import app
from src.leaderboard import queries
from src.leaderboard.ranking import MAX_LIMIT
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
        from datetime import datetime, timezone

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
        mock_fetch.assert_called_once_with(MAX_LIMIT)

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
