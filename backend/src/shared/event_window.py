"""Resolving the active event's date range: EVENT_START/EVENT_END, and the
?from=/?to= query parameters that can override them per-request. Lives in
shared/, not in leaderboard/, on the same test as db.py and levels.py (see
the design spec's §8): a second feature added to this backend later would
almost certainly want "is this timestamp within the currently configured
event" too, and the two pieces that make that reusable -- reading the env
vars, and parsing a timestamp strictly -- belong here rather than being
copied.

The deployment gets reused across events, so without a range every event's
board would show every other event's rows too. The range is env-var
configured rather than a database row on purpose (see
src/shared/db.py's own docstring for the shape of that kind of decision in
this codebase): changing it means a redeploy, which the operator has
already accepted.

Three rules this module exists to enforce, all load-bearing:

1. Both env vars are optional and independent. Neither set means no
   filtering at all -- deploying this feature must not change behaviour
   until someone configures it, mirroring how
   frontend/src/engine/leaderboardClient.ts's VITE_LEADERBOARD_API gates
   that whole feature. Only EVENT_START set means "from then onward",
   which is what an in-progress event looks like.

2. A timestamp MUST carry an explicit UTC offset (parse_offset_timestamp
   below) -- "2026-08-22T09:00:00+08:00" is accepted,
   "2026-08-22T09:00:00" is REJECTED. The booth runs in Taiwan (UTC+8) and
   the database speaks UTC; silently treating an offset-less value as UTC
   would shift the window by eight hours, quietly excluding the whole
   first morning of the event while the board still looks perfectly
   normal, just emptier. Forcing whoever writes EVENT_START, EVENT_END, or
   ?from=/?to= to be explicit is the entire point -- guessing on their
   behalf would defeat it even when the guess happens to be right.

3. A malformed *configured* value (EVENT_START/EVENT_END) must fail loudly
   rather than be swallowed into "no filtering" or an empty board -- see
   resolve_event_window below and src/leaderboard/router.py's
   get_leaderboard, which lets this module's exception propagate into its
   existing generic 500 handler rather than catching it locally. A
   malformed *query* value (?from=/?to=) is different: that is client
   input, so router.py catches it itself and answers 400, matching how the
   rest of this API answers bad input.
"""

import os
from datetime import datetime


class OffsetTimestampError(ValueError):
    """Raised by parse_offset_timestamp (directly, or via
    parse_optional_bound/resolve_event_window) when a string is not a
    valid ISO 8601 timestamp, or is valid but carries no explicit UTC
    offset. A ValueError subclass rather than a bare ValueError only so
    callers that care can catch this specifically without also catching
    unrelated ValueErrors -- see router.py's get_leaderboard, which does
    exactly that to tell a bad ?from=/?to= (400) apart from every other
    failure (500).
    """


def parse_offset_timestamp(raw: str) -> datetime:
    """Parse an ISO 8601 timestamp that MUST carry an explicit UTC offset,
    e.g. "2026-08-22T09:00:00+08:00" ("Z" also counts -- it names zero
    offset explicitly, which satisfies the rule exactly as "+00:00" would).
    Bare "2026-08-22T09:00:00" -- no offset -- raises OffsetTimestampError
    rather than being treated as UTC. See this module's docstring, rule 2,
    for why that has to be a hard error rather than a convenience default.

    Reused by both EVENT_START/EVENT_END (via resolve_event_window below)
    and the ?from=/?to= query parameters (router.get_leaderboard): the
    identical rule applies to both, so it is written once rather than
    twice and risking the two copies drifting apart.
    """
    try:
        moment = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise OffsetTimestampError(f"{raw!r} is not a valid ISO 8601 timestamp") from exc
    if moment.tzinfo is None:
        raise OffsetTimestampError(
            f"{raw!r} has no UTC offset -- an explicit offset (e.g. +08:00) "
            "is required and never assumed"
        )
    return moment


def parse_optional_bound(raw: str | None) -> datetime | None:
    """None, or a blank/whitespace-only string, means "not provided" and
    returns None -- mirroring ranking.parse_limit's deliberate "blank
    means absent" rule (see that function's docstring for why this is a
    principled reading rather than an accident) so an empty ?from= behaves
    like an absent one instead of a parse error. Any other value is parsed
    strictly by parse_offset_timestamp and raises OffsetTimestampError if
    malformed.
    """
    if raw is None:
        return None
    stripped = raw.strip()
    if stripped == "":
        return None
    return parse_offset_timestamp(stripped)


def _env_bound(name: str) -> datetime | None:
    """Read and parse one EVENT_START/EVENT_END variable. Unset or blank
    means None, matching parse_optional_bound. A malformed value's
    OffsetTimestampError is re-raised with the variable name attached --
    parse_offset_timestamp only knows the string, not which setting it
    came from, and that name is exactly what an operator needs to find a
    typo in a deploy config. This text is for server-side logs only (see
    router.py's get_leaderboard, which logs it via logger.exception and
    replies with the unrelated, hard-coded generic 500 body) -- it is
    never constructed with the client in mind.
    """
    try:
        return parse_optional_bound(os.environ.get(name))
    except OffsetTimestampError as exc:
        # exc's own message already names the offending value (see
        # parse_offset_timestamp) -- prefixing with just the variable name,
        # not the value again, is what actually adds information here.
        raise OffsetTimestampError(f"{name}: {exc}") from exc


def resolve_event_window(
    *, override_start: datetime | None, override_end: datetime | None
) -> tuple[datetime | None, datetime | None]:
    """The effective (start, end) bounds for "this event's leaderboard",
    both already-parsed and both optional -- either or both may come back
    None, meaning "no bound on this side".

    Each bound is resolved independently, and an override is a full
    replacement, not a merge: when override_start is given, EVENT_START is
    not read at all -- so a malformed EVENT_START can never break a
    request that supplies ?from=, and likewise for override_end/EVENT_END.
    This is what "?from= overrides EVENT_START" means as a precedence
    rule: the env var is consulted only when nothing more specific was
    supplied for that particular bound -- the same request-scoped-value-
    beats-configured-default shape ranking.parse_limit() already uses
    elsewhere in this API, just with an env var standing in for the
    hard-coded DEFAULT_LIMIT.

    override_start/override_end are expected to already be parsed (see
    router.get_leaderboard, which parses ?from=/?to= itself, before
    calling this function, specifically so a malformed *query* value can
    be turned into a 400 there without ever reaching this function's
    env-reading path, which is reserved for configured-value failures).
    """
    start = override_start if override_start is not None else _env_bound("EVENT_START")
    end = override_end if override_end is not None else _env_bound("EVENT_END")
    return start, end
