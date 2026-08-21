"""Pydantic request schema and validation for the leaderboard's progress
endpoint -- the Python port of validate.ts, removed along with the rest of
the TypeScript backend once this port finished (see git history for it).
Several of the rules below look arbitrary in isolation but were arrived at
by fixing real bugs, and each comment below says which.

Two behaviours this file exists to preserve exactly:

- Input is camelCase (profileId/displayName/entryPoint/levelId) because that
  is what frontend/src/engine/leaderboardClient.ts sends on the wire.
  Pydantic defaults to the declared Python field name, not the alias, so
  every field below carries an explicit `alias` -- get this wrong and every
  request from the real frontend fails validation.

- depth is never read from the client. ProgressRequest simply has no
  `depth` field, and Pydantic's default `extra="ignore"` throws away any
  extra key a client sends before any of our code could read it -- the same
  structural guarantee Zod gives validate.ts, whose schema has no such field
  either. depth_for_level() derives the real value from the (validated)
  levelId instead, inside parse_progress_body() below.
"""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.shared.levels import depth_for_level

EntryPoint = Literal["L0", "L1", "L2"]
ENTRY_POINTS: tuple[EntryPoint, ...] = ("L0", "L1", "L2")

MAX_DISPLAY_NAME_LENGTH = 24

# profileId arrives straight from the browser's localStorage. It is usually a
# crypto.randomUUID(), but frontend/src/engine/profileId.ts falls back to
# `profile-<timestamp>-<random>` on browsers without crypto.randomUUID (older
# browsers, non-secure-context http pages), so this pattern accepts both
# shapes rather than demanding a UUID. Rejecting the fallback shape would
# make those players silently vanish from the leaderboard, on some devices
# only -- exactly the kind of bug that never shows up in the developer's own
# browser. schema.sql also declares profile_id as TEXT rather than UUID for
# the same reason.
PROFILE_ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"


def sanitize_display_name(raw: str) -> str:
    """Trim and cap only -- this is NOT content moderation, which is
    deliberately out of scope (see the spec's 不做 table). It exists so an
    arbitrarily long string cannot reach the database. Returns "" for a
    blank name; the caller (parse_progress_body) rejects that outright,
    because there is no anonymous-player concept in this system.

    The cap counts code points, not UTF-16 code units. validate.ts has to
    spread the string into an array (`[...raw]`) before slicing, because a
    plain JavaScript `.slice(0, 24)` walks UTF-16 code units and can cut an
    astral character (e.g. an emoji) in half, leaving a lone surrogate that
    is not valid UTF-8 and would fail on the way to Postgres. Python's `str`
    has no UTF-16 concept to begin with -- every index is already a full
    Unicode code point (PEP 393) -- so the plain slice below is already
    correct as written. This isn't a smaller version of the same bug lying
    in wait; the bug cannot occur in Python, which is why this function is a
    third the length of its TypeScript counterpart.
    """
    return raw.strip()[:MAX_DISPLAY_NAME_LENGTH].strip()


class ProgressRequest(BaseModel):
    """The shape of the POST /api/leaderboard/progress body, straight off
    the wire. The Python port of validate.ts's (unexported) `progressSchema`.

    Deliberately declares no `depth` field. `extra="ignore"` is Pydantic's
    default already, but it is pinned explicitly here because the property
    it gives us is load-bearing: a client-supplied "depth" is discarded
    during validation itself, never becomes an attribute, never appears in
    model_dump(), and so cannot influence anything downstream even by
    accident. depth is always derived server-side from levelId, in
    parse_progress_body() below.

    Only the camelCase alias is accepted for input -- `populate_by_name` is
    left at its default of False on purpose, so `profile_id` (the Python
    name) does *not* also work as a key. This mirrors validate.ts exactly,
    which has no snake_case spelling to accept in the first place; see
    LeaderboardEntry in ranking.py for the one model in this backend that
    does need both spellings, and why.
    """

    model_config = ConfigDict(extra="ignore")

    profile_id: str = Field(alias="profileId", pattern=PROFILE_ID_PATTERN)
    display_name: str | None = Field(default=None, alias="displayName")
    entry_point: EntryPoint = Field(alias="entryPoint")
    level_id: str = Field(alias="levelId")


@dataclass(frozen=True, slots=True)
class ProgressInput:
    """A validated, normalised progress report -- the Python port of
    validate.ts's `ProgressInput` interface. Unlike ProgressRequest this is
    never parsed from JSON and never serialised back to a client; it is
    handed straight to the database layer (queries.py, Task P3), so it
    carries no camelCase aliases.
    """

    profile_id: str
    display_name: str
    entry_point: EntryPoint
    level_id: str
    depth: int


@dataclass(frozen=True, slots=True)
class ParseOk:
    """parse_progress_body succeeded; `value` is the normalised report."""

    value: ProgressInput
    ok: Literal[True] = True


@dataclass(frozen=True, slots=True)
class ParseError:
    """parse_progress_body failed; `error` is a human-readable detail
    string. Never derived from a raw exception message -- see
    _format_validation_error -- so it is always safe to hand to a client.
    """

    error: str
    ok: Literal[False] = False


ParseResult = ParseOk | ParseError


def _format_validation_error(exc: ValidationError) -> str:
    """A compact "path: message; path: message" summary, echoing the shape
    validate.ts builds from Zod's issue list. Deliberately not `str(exc)`:
    Pydantic's default rendering is a multi-line block that appends a
    documentation URL to every error, which is noisier than a 400 body
    needs and not a shape we want to commit to matching byte-for-byte.
    """
    parts = []
    for err in exc.errors():
        path = ".".join(str(segment) for segment in err["loc"]) or "(root)"
        parts.append(f"{path}: {err['msg']}")
    return "; ".join(parts)


def parse_progress_body(body: object) -> ParseResult:
    """Validate an untrusted request body end to end: structural checks
    (types, the profileId pattern, the entryPoint whitelist) via
    ProgressRequest, then the two checks a structural schema alone could not
    express. The Python port of validate.ts's `parseProgressBody`; accepts
    `object` (Python's nearest equivalent of TypeScript's `unknown`) because
    a request body can be anything -- including `None` or a bare string --
    before it has been shown to be well-formed.
    """
    try:
        request = ProgressRequest.model_validate(body)
    except ValidationError as exc:
        return ParseError(error=_format_validation_error(exc))

    # Depth is derived here, never read off the request -- a client that
    # claims to have cleared L3-Bonus still only scores whatever levelId it
    # names, and an unrecognised levelId is refused outright.
    depth = depth_for_level(request.level_id)
    if depth is None:
        return ParseError(error=f'unknown levelId "{request.level_id}"')

    # No nickname, no leaderboard entry. The client already declines to
    # upload in this case (see leaderboardClient.ts), so reaching here means
    # something bypassed it -- refuse rather than inventing a placeholder
    # name. `??`'s Python equivalent is spelled out (rather than `or`)
    # because `or` would also treat an explicit "" the same as a missing
    # field, which happens to be what we want here too, but only by
    # coincidence -- the explicit form says which rule is actually meant.
    display_name = sanitize_display_name(
        request.display_name if request.display_name is not None else ""
    )
    if display_name == "":
        return ParseError(error="displayName must not be empty")

    return ParseOk(
        value=ProgressInput(
            profile_id=request.profile_id,
            display_name=display_name,
            entry_point=request.entry_point,
            level_id=request.level_id,
            depth=depth,
        )
    )
