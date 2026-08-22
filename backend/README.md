# backend

FastAPI service for the leaderboard feature. It deploys as its own Vercel
project (see `vercel.json` and `api/index.py`) and exists as Python because
that's what the club's members recognise. `src/app.py` mounts one
`APIRouter` per feature -- today just `src/leaderboard/router.py`.

## Setup

Create a venv and install the dev dependencies (`requirements-dev.txt`
pulls in the runtime ones from `requirements.txt` too):

```
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

## Running the tests

```
.venv/bin/pytest -q
```

The repo root's `.pre-commit-config.yaml` runs `backend/.venv/bin/pytest`
directly on every commit that touches a `backend/**/*.py` file, so it
expects this exact venv to exist at `backend/.venv` -- run the setup step
above before committing here.

## Database

No migration framework -- apply the schema by hand against the Neon
database:

```
psql "$DATABASE_URL" -f src/leaderboard/schema.sql
```

`DATABASE_URL` is injected automatically by Vercel once the Neon
integration is attached to this project. For local development, set it
yourself; see `.env.example`.

## Event date range

The same deployment gets reused across events, so `GET /api/leaderboard`
can be restricted to a single event's date range with two optional,
independent environment variables:

```
EVENT_START=2026-08-22T09:00:00+08:00
EVENT_END=2026-08-23T00:00:00+08:00
```

Neither is required. Leaving both unset means no filtering at all -- the
query is byte-for-byte what it is without this feature. Setting only
`EVENT_START` means "from then onward", which is what an in-progress
event looks like.

The offset (`+08:00` above, for a booth running on Taiwan time) is
**mandatory**. `passed_at` is stored in the database as UTC, so a value
with no offset would have to be *assumed* to mean something rather than
*read* -- and assuming wrong by even one timezone silently shifts the
whole window, quietly excluding real passes with no error and a board
that just looks emptier than it should. A bare value with no offset (e.g.
`2026-08-22T09:00:00`) is rejected outright rather than guessed at. A
malformed `EVENT_START`/`EVENT_END` makes `GET /api/leaderboard` fail
loudly with a `500` (the problem is logged server-side) instead of
silently falling back to an unfiltered or an empty board -- an empty
board is indistinguishable from "nobody has played yet", which is the
worst possible way to discover a typo in a deploy variable.

The interval is half-open: `passed_at >= EVENT_START and passed_at <
EVENT_END`. `EVENT_END` names the first *excluded* instant, so the
example above means "through the end of 22 August", full stop -- there is
no separate question of whether `23:59:59.999` on the 22nd counts.

A request's own `?from=`/`?to=` query parameters can override either
variable independently for that one request (a supplied `from` replaces
`EVENT_START`; a supplied `to` replaces `EVENT_END`; supplying only one
leaves the other variable in effect) -- e.g. for a big-screen display
pinned to a shorter window than the whole event. They follow the same
mandatory-offset rule and are rejected with a `400` if it's missing,
matching how the rest of this API answers bad input. When testing with
`curl` or a browser address bar, percent-encode `+` as `%2B` in the query
string (`?from=2026-08-22T09%3A00%3A00%2B08%3A00`) -- a literal `+` in a
query string is decoded as a space by the URL spec, which is not this
feature's doing and applies to any timestamp-bearing query parameter, not
just this one.

`frontend/src/engine/leaderboardClient.ts` never sends `?from=`/`?to=`, so
none of this affects the frontend -- it only takes effect once
`EVENT_START`/`EVENT_END` is actually set. See
`src/shared/event_window.py` for the implementation and precedence rules,
and `src/leaderboard/queries.py` for why the filter has to live inside the
leaderboard's ranking query rather than after it.
