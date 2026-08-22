"""Vercel's entry point for this Python function. vercel.json rewrites all
of /api/* here; FastAPI's own routing (src/app.py, dispatching to
src/leaderboard/router.py) takes it from there using the original request
path, which is why every route in router.py is declared with its full
/api/... path rather than relying on this file's own location.

The only platform-specific file in this backend -- see the design spec's
file-structure section for why: swapping platforms later means rewriting
only this file, nothing under src/.
"""

from src.app import app

__all__ = ["app"]
