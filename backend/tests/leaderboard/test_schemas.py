"""Tests for src.leaderboard.schemas -- the Python port of validate.ts.

Mirrored backend/test/leaderboard/validate.test.ts case-for-case (14 cases:
4 for sanitize_display_name, 10 for parse_progress_body; that file was
removed when the TypeScript backend was retired, see git history for it),
plus checks that only make sense in the Python port: that ProgressRequest
actually accepts the frontend's camelCase field names (and rejects the
Python ones), and
that a client-supplied "depth" is discarded structurally rather than merely
overwritten later. See schemas.py's docstrings for why each rule exists.
"""

import pytest
from pydantic import ValidationError

from src.leaderboard.schemas import (
    MAX_DISPLAY_NAME_LENGTH,
    ParseError,
    ParseOk,
    ProgressRequest,
    parse_progress_body,
    sanitize_display_name,
)

VALID = {
    "profileId": "3f2a4b6c-1111-2222-3333-444455556666",
    "displayName": "阿明",
    "entryPoint": "L1",
    "levelId": "L2-0",
}


class TestSanitizeDisplayName:
    def test_trims_surrounding_whitespace(self) -> None:
        assert sanitize_display_name("  阿明  ") == "阿明"

    def test_caps_the_name_at_the_maximum_length(self) -> None:
        long_name = "a" * 100
        assert len(sanitize_display_name(long_name)) == MAX_DISPLAY_NAME_LENGTH

    def test_returns_empty_string_for_a_blank_name_leaving_the_caller_to_reject(
        self,
    ) -> None:
        assert sanitize_display_name("   ") == ""

    def test_counts_the_cap_in_code_points_so_an_emoji_is_not_cut_in_half(self) -> None:
        # 23 ASCII letters followed by one astral-plane emoji. In JavaScript
        # that emoji is a surrogate pair spanning two UTF-16 code units, so
        # validate.ts has to spread the string into code points before
        # slicing, or a plain .slice(0, 24) would cut the pair in half and
        # leave a lone surrogate -- not valid UTF-8. Python's `str` is
        # already code-point indexed (PEP 393): there is no pair to cut, so
        # a plain slice keeps the whole emoji and len() below counts code
        # points, not UTF-16 units, with no extra work.
        name = "a" * 23 + "🙂"
        result = sanitize_display_name(name)
        assert len(result) == MAX_DISPLAY_NAME_LENGTH
        assert result == "a" * 23 + "🙂"


class TestParseProgressBody:
    def test_accepts_a_well_formed_body_and_derives_the_depth_server_side(self) -> None:
        result = parse_progress_body(VALID)
        assert isinstance(result, ParseOk)
        assert result.value.depth == 9
        assert result.value.level_id == "L2-0"

    def test_ignores_any_depth_the_client_tries_to_supply(self) -> None:
        result = parse_progress_body({**VALID, "depth": 23})
        assert isinstance(result, ParseOk)
        assert result.value.depth == 9

    def test_accepts_the_non_uuid_fallback_profile_id_shape(self) -> None:
        result = parse_progress_body(
            {**VALID, "profileId": "profile-1755740000000-x8f2q1"}
        )
        assert isinstance(result, ParseOk)

    def test_rejects_an_unknown_level_id(self) -> None:
        result = parse_progress_body({**VALID, "levelId": "L9-99"})
        assert isinstance(result, ParseError)
        assert "L9-99" in result.error

    def test_rejects_an_entry_point_outside_the_whitelist(self) -> None:
        result = parse_progress_body({**VALID, "entryPoint": "L3"})
        assert isinstance(result, ParseError)

    def test_rejects_a_profile_id_with_unexpected_characters(self) -> None:
        result = parse_progress_body({**VALID, "profileId": "<script>"})
        assert isinstance(result, ParseError)

    def test_rejects_an_over_long_profile_id(self) -> None:
        result = parse_progress_body({**VALID, "profileId": "a" * 65})
        assert isinstance(result, ParseError)

    def test_rejects_a_non_object_body(self) -> None:
        assert isinstance(parse_progress_body(None), ParseError)
        assert isinstance(parse_progress_body("nope"), ParseError)

    def test_rejects_a_missing_display_name_there_is_no_anonymous_player(self) -> None:
        without_name = {k: v for k, v in VALID.items() if k != "displayName"}
        result = parse_progress_body(without_name)
        assert isinstance(result, ParseError)
        assert "displayName" in result.error

    def test_rejects_a_whitespace_only_display_name(self) -> None:
        result = parse_progress_body({**VALID, "displayName": "   "})
        assert isinstance(result, ParseError)


class TestProgressRequestAcceptsCamelCase:
    """Rule 1: the frontend only ever sends camelCase. Pydantic defaults to
    the declared field name rather than the alias, so getting this wrong
    would fail every request from the real frontend -- not a hypothetical,
    since this is precisely the bug this rule exists to prevent.
    """

    def test_accepts_the_frontends_camelcase_field_names(self) -> None:
        request = ProgressRequest.model_validate(VALID)
        assert request.profile_id == VALID["profileId"]
        assert request.display_name == VALID["displayName"]
        assert request.entry_point == VALID["entryPoint"]
        assert request.level_id == VALID["levelId"]

    def test_does_not_also_accept_the_python_snake_case_names(self) -> None:
        # Guards against someone adding populate_by_name=True later and
        # quietly widening accepted input beyond what the frontend sends --
        # see the docstring on ProgressRequest for why that would matter.
        with pytest.raises(ValidationError):
            ProgressRequest.model_validate(
                {
                    "profile_id": VALID["profileId"],
                    "displayName": VALID["displayName"],
                    "entryPoint": VALID["entryPoint"],
                    "levelId": VALID["levelId"],
                }
            )


class TestDepthIsNeverClientSupplied:
    """Rule 2: the request model must not declare `depth` at all, and a
    client-supplied one must vanish before any code could read it -- not
    merely be overwritten later. This is structural, the same guarantee Zod
    gives validate.ts by simply never declaring the field, so it is checked
    directly against Pydantic's default `extra` behaviour rather than only
    indirectly through parse_progress_body (already covered above by
    "ignores any depth the client tries to supply").
    """

    def test_progress_request_has_no_depth_attribute_even_when_one_is_sent(self) -> None:
        request = ProgressRequest.model_validate({**VALID, "depth": 999})
        assert not hasattr(request, "depth")

    def test_model_dump_never_contains_depth_in_either_case(self) -> None:
        request = ProgressRequest.model_validate({**VALID, "depth": 999})
        assert "depth" not in request.model_dump()
        assert "depth" not in request.model_dump(by_alias=True)
