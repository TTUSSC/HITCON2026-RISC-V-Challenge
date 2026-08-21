"""APIRouter for the leaderboard feature -- the Python port of
routes/progress.ts and routes/list.ts (reached via
api/leaderboard/progress.ts and api/leaderboard/index.ts). Read both files'
comments before touching this one.

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
turning their results into an HTTP response.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.leaderboard import queries
from src.leaderboard.ranking import parse_limit, rank_entries
from src.leaderboard.schemas import parse_progress_body

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
async def get_leaderboard(limit: str | None = None) -> JSONResponse:
    """The Python port of routes/list.ts's handler.

    `limit: str | None` deliberately does not type the parameter as `int`:
    ranking.parse_limit() is written to tolerate arbitrary untrusted input
    (an absent value, a blank string, "99999", non-numeric junk) and never
    raise, defaulting instead -- declaring `limit: int` here would let
    FastAPI reject a non-numeric limit with a 422-turned-400 before
    parse_limit() ever saw it, which would still be a 400 on the wire but
    would silently stop exercising the clamping logic parse_limit() exists
    to provide, and diverge from parseLimit(req.query.limit)'s contract of
    accepting literally anything.
    """
    # rank_entries() and the response construction below are deliberately
    # inside this try block too, not just fetch_best_passes() -- mirroring
    # list.ts, where `rankEntries(rows)` and `res.status(200).json(...)`
    # both run inside the same try as `fetchBestPasses(...)`. Neither is
    # expected to raise on the well-formed rows fetch_best_passes()
    # guarantees, but matching the original's exception-safety boundary
    # exactly, rather than narrowing it to only the DB call, costs nothing
    # and means a future change to either function inherits the same
    # never-leak-a-message guarantee automatically instead of by accident.
    try:
        rows = queries.fetch_best_passes(parse_limit(limit))
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
