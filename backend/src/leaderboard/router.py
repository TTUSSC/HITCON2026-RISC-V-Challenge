"""APIRouter for the leaderboard feature -- the Python port of
routes/progress.ts and routes/list.ts (reached via
api/leaderboard/progress.ts and api/leaderboard/index.ts), all four removed
along with the rest of the TypeScript backend once this port finished (see
git history for them); the reasoning their comments recorded is carried
forward below.

Route paths are written out in full, /api prefix included, rather than
built from an APIRouter(prefix=...): Vercel rewrites all of /api/* to this
one Python entry point (see vercel.json and api/index.py), so this router
has to do the same job Vercel's file-based routing used to do for the
TypeScript handlers -- dispatch on the full original path itself.

CORS and the GET/POST method check that http.ts's handleCorsAndMethod used
to do by hand for every route are gone from here on purpose: FastAPI's own
routing already answers a wrong method with 405, and CORS is one line of
middleware in src/app.py shared by every route instead of fifteen lines
repeated per handler. See app.py for both.

parse_progress_body(), parse_limit() and rank_entries() are P2's, imported
rather than reimplemented, exactly as instructed -- this file's only job is
turning their results into an HTTP response. resolve_event_window(),
parse_optional_bound() and OffsetTimestampError are src/shared/'s, for the
same reason: the event date-range filter's env-var reading and timestamp
parsing live there so a second feature could reuse them (see that module's
docstring), and this file's job for that feature is likewise just wiring
it into GET /api/leaderboard's HTTP response.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from src.leaderboard import queries
from src.leaderboard.ranking import parse_limit, rank_entries
from src.leaderboard.schemas import parse_progress_body
from src.shared.event_window import (
    OffsetTimestampError,
    parse_optional_bound,
    resolve_event_window,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _now_iso8601() -> str:
    """'now', in the same JS-`Date.prototype.toISOString()` shape
    ranking._to_iso8601 produces for reachedAt: UTC, millisecond precision,
    a literal "Z" (see that function's docstring for why plain
    `datetime.isoformat()` is not a substitute). Reimplemented here in four
    lines rather than imported, because that helper is module-private
    (leading underscore) to ranking.py and this is its only caller outside
    that module -- duplicating four lines beats reaching into another
    module's private helper for a one-line saving.
    """
    now = datetime.now(timezone.utc)
    milliseconds = now.microsecond // 1000
    return now.strftime("%Y-%m-%dT%H:%M:%S") + f".{milliseconds:03d}Z"


@router.post("/api/leaderboard/progress")
async def post_progress(body: dict[str, Any]) -> JSONResponse:
    """The Python port of routes/progress.ts's handler.

    `body: dict[str, Any]` deliberately does not type the parameter as the
    ProgressRequest Pydantic model: doing so would let FastAPI's own
    request-body validation reject a malformed field (a bad profileId
    pattern, an unknown entryPoint) before parse_progress_body() ever runs,
    duplicating validation across two places that would need to be kept in
    sync. Instead FastAPI is only asked to confirm the body is a JSON
    object at all -- a non-object body (null, a bare string, an array)
    already fails that much and is turned into a 400 by the
    RequestValidationError override in app.py -- and parse_progress_body()
    remains the single place that does every other check, exactly as
    parseProgressBody(req.body) was the single place in the TypeScript
    version.
    """
    parsed = parse_progress_body(body)
    if not parsed.ok:
        return JSONResponse(status_code=400, content={"ok": False, "error": parsed.error})

    try:
        queries.record_progress(parsed.value)
    except Exception:
        # Logged for whatever the deployment platform's log viewer is,
        # never echoed to the client -- a connection string can appear in
        # a psycopg exception, and this repo is public.
        logger.exception("POST /api/leaderboard/progress failed")
        return JSONResponse(status_code=500, content={"ok": False, "error": "internal error"})

    return JSONResponse(status_code=200, content={"ok": True, "depth": parsed.value.depth})


@router.get("/api/leaderboard")
async def get_leaderboard(
    limit: str | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
) -> JSONResponse:
    """The Python port of routes/list.ts's handler, extended with the
    event date-range filter: `?from=`/`?to=` optionally override the
    EVENT_START/EVENT_END env vars, independently, per request (see
    src/shared/event_window.py for the full precedence and validation
    rules this wires up).

    `limit: str | None` deliberately does not type the parameter as `int`:
    ranking.parse_limit() is written to tolerate arbitrary untrusted input
    (an absent value, a blank string, "99999", non-numeric junk) and never
    raise, defaulting instead -- declaring `limit: int` here would let
    FastAPI reject a non-numeric limit with a 422-turned-400 before
    parse_limit() ever saw it, which would still be a 400 on the wire but
    would silently stop exercising the clamping logic parse_limit() exists
    to provide, and diverge from parseLimit(req.query.limit)'s contract of
    accepting literally anything. `from_`/`to` are `str | None` for the
    same reason, so parse_optional_bound() -- not FastAPI's own validation
    -- decides what counts as well-formed. The parameter is named `from_`
    only because `from` is a Python keyword; `Query(alias="from")` is what
    still binds it to the actual `?from=` query key on the wire. `to`
    needs no such alias -- it collides with nothing.
    """
    # Query-parameter parsing happens in its own try block, BEFORE the
    # fetch/rank/respond block below, and is deliberately the only thing
    # that can produce this endpoint's new 400: a bad ?from=/?to= is
    # client input, so it is rejected the same way every other bad input
    # on this API is (see schemas.parse_progress_body's ParseError and
    # app.py's RequestValidationError handler, both of which answer
    # {"ok": false, "error": ...}). A malformed EVENT_START/EVENT_END, by
    # contrast, is a server misconfiguration, not client input -- it is
    # deliberately left to surface inside the try block below instead,
    # where it falls into the SAME generic 500 every other failure on this
    # endpoint already produces (rule: log the exact problem, never fall
    # back to "no filtering" or an empty board, since an empty board is
    # indistinguishable from "nobody has played yet" -- the worst possible
    # way for a misconfiguration to present itself).
    try:
        override_start = parse_optional_bound(from_)
        override_end = parse_optional_bound(to)
    except OffsetTimestampError as exc:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(exc)})

    # rank_entries() and the response construction below are deliberately
    # inside this try block too, not just fetch_best_passes() -- mirroring
    # list.ts, where `rankEntries(rows)` and `res.status(200).json(...)`
    # both run inside the same try as `fetchBestPasses(...)`. Neither is
    # expected to raise on the well-formed rows fetch_best_passes()
    # guarantees, but matching the original's exception-safety boundary
    # exactly, rather than narrowing it to only the DB call, costs nothing
    # and means a future change to either function inherits the same
    # never-leak-a-message guarantee automatically instead of by accident.
    # resolve_event_window() is inside this same block for a sharper
    # reason, not just consistency: it is what can raise
    # OffsetTimestampError for a malformed *configured* value, and that
    # needs to hit this generic 500 -- logged in full via
    # logger.exception() below, never echoed to the client -- rather than
    # the 400 above, which is reserved for the query parameters only.
    try:
        start, end = resolve_event_window(
            override_start=override_start, override_end=override_end
        )
        rows = queries.fetch_best_passes(parse_limit(limit), start=start, end=end)
        entries = rank_entries(rows)
        return JSONResponse(
            status_code=200,
            content={
                "entries": [entry.model_dump(by_alias=True) for entry in entries],
                "updatedAt": _now_iso8601(),
            },
            # A few seconds of edge caching absorbs a big-screen display
            # polling this without making the board feel stale in a booth
            # setting. Set only on the success path -- exactly where
            # list.ts sets it, so a failed fetch never gets an (empty,
            # wrong) response cached either.
            headers={"Cache-Control": "public, s-maxage=5, stale-while-revalidate=15"},
        )
    except Exception:
        logger.exception("GET /api/leaderboard failed")
        # No `ok` key here, unlike the progress endpoint's 500 body above --
        # that asymmetry is inherited from list.ts's catch block as
        # reviewed, not introduced by the port.
        return JSONResponse(status_code=500, content={"error": "internal error"})
