"""Connection only -- no feature-specific SQL belongs here. Each feature
keeps its queries beside the rest of that feature (see
src/leaderboard/queries.py), so adding a second feature never touches this
file. The Python port of db.ts, which was removed along with the rest of
the TypeScript backend when this port finished (see git history for it);
the reasoning its comments recorded is carried forward below.

db.ts memoizes an HTTP-based client on purpose: a Vercel serverless function
is torn down after each request, so a pooled TCP client would leak
connections until the database starts refusing new ones. Python has no
equivalent HTTP-based Postgres driver, so this opens a plain psycopg
connection over ordinary TCP instead -- which would normally reintroduce
exactly the problem the TypeScript driver was chosen to avoid, except the
DATABASE_URL Neon issues is already a pgbouncer-pooled connection string:
the pooling this file would otherwise need to implement itself already
happens on the far side of the socket (see the design spec, section 8).

So only the connection *string* is memoized here -- reading and validating
an environment variable once is worth caching -- while the connection
itself is opened fresh on every call to get_connection(), one per request,
matching the lifetime a serverless invocation gives it. A module-level
*connection* singleton (mirroring db.ts's `client` variable literally)
would risk handing back a connection that went stale while the container
sat idle between invocations, which the memoized-string-plus-fresh-connection
shape avoids entirely.
"""

import os

import psycopg
from psycopg.rows import dict_row

_database_url: str | None = None


def get_database_url() -> str:
    """DATABASE_URL, read from the environment once and memoized for the
    life of the process. Raises RuntimeError -- a deliberate, explicit
    error, not a bare KeyError or a confusing failure from deep inside
    psycopg -- if it is unset, mirroring db.ts's own explicit throw.
    """
    global _database_url
    if _database_url is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL is not set")
        _database_url = url
    return _database_url


def get_connection() -> psycopg.Connection:
    """A fresh psycopg connection over plain TCP, using the memoized
    connection string. Rows come back as dicts keyed by column name
    (row_factory=dict_row) rather than plain tuples -- the natural
    Python analogue of the `Record<string, unknown>` rows the neon driver
    hands queries.ts, and what lets queries.py read a row by column name
    instead of by position.

    Returned as a plain psycopg.Connection rather than already opened
    inside a `with` block, so callers control the transaction boundary --
    see queries.py's record_progress() for why that matters here: its two
    statements must NOT share a transaction.
    """
    return psycopg.connect(get_database_url(), row_factory=dict_row)
