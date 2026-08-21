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
