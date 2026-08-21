"""The FastAPI application. Every feature mounts its own APIRouter here --
today that's just src/leaderboard/router.py, so adding a second feature
later is one more import and one more include_router() call, not a
restructure.

Vercel-specific wiring stops at api/index.py, which does nothing but import
`app` from this module; nothing in this file or below it knows it is
running on Vercel.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.leaderboard.router import router as leaderboard_router

app = FastAPI()

# Allow-Origin is "*" because this API is public, carries no cookie and no
# Authorization header, so there is no cross-origin credential to protect --
# the same reasoning http.ts's handleCorsAndMethod recorded for its own
# hand-written CORS headers, replaced here by one shared middleware instead
# of a helper every route had to remember to call first. In production the
# frontend reaches this same-origin through a /api/* rewrite anyway; these
# headers only matter when something calls this backend's own domain
# directly (local development, or a big-screen display). allow_credentials
# is left False (the default, made explicit here) because "*" and
# credentialed requests are mutually exclusive by the CORS spec itself --
# there is no credential in play here for that to ever bite.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """FastAPI's default for a request that fails validation is 422; the
    contract this backend ports from TypeScript is 400 everywhere else
    (see schemas.parse_progress_body's ParseError, always turned into a
    400 by the router). The frontend never reads the status code here --
    leaderboardClient.ts's submitPass() is fire-and-forget and does not
    even inspect the response -- so this has no effect on behaviour a
    player could notice. What it fixes is 422 and 400 showing up mixed
    together in logs for what is, from this API's point of view, the same
    kind of failure, which would make debugging a real spike in bad
    requests harder to spot later.
    """
    return JSONResponse(
        status_code=400,
        content={"ok": False, "error": "invalid request", "detail": exc.errors()},
    )


app.include_router(leaderboard_router)
