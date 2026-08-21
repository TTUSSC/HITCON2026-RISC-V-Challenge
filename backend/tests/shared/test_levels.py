"""Tests for src.shared.levels — the level-order table the whole leaderboard
ranking scheme depends on.

Mirrors backend/test/shared/levels.test.ts case-for-case. See that file and
src/shared/levels.py's module docstring for why "L2-0 lands at depth 9" is
the one case below that isn't just sampling: it is what lets an L2 entrant
who clears L2-0 tie an L0 entrant who ground through eight levels to reach
the same leaderboard position. If that assertion ever breaks, the whole
three-entry-point ranking scheme breaks with it, and it would not look
obviously wrong.
"""

from src.shared.levels import LEVEL_ORDER, MAX_DEPTH, depth_for_level


class TestDepthForLevel:
    def test_first_level_is_depth_1(self) -> None:
        assert depth_for_level("L0-1") == 1

    def test_l2_0_is_depth_9_so_the_l2_entry_point_ties_a_full_l0_run(self) -> None:
        assert depth_for_level("L2-0") == 9

    def test_final_level_is_max_depth(self) -> None:
        assert depth_for_level("L3-Bonus") == MAX_DEPTH

    def test_unknown_level_id_returns_none(self) -> None:
        assert depth_for_level("L9-99") is None

    def test_empty_string_returns_none(self) -> None:
        assert depth_for_level("") is None


class TestLevelOrder:
    def test_has_23_levels(self) -> None:
        assert MAX_DEPTH == 23

    def test_contains_no_duplicate_ids(self) -> None:
        assert len(set(LEVEL_ORDER)) == len(LEVEL_ORDER)
