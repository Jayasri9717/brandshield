"""Unit tests for the detection package. Sections are added per module."""

import pytest

from app.detection.similarity import (
    combined_similarity,
    jaro_winkler_similarity,
    levenshtein_distance,
    levenshtein_similarity,
)


# ---------------------------------------------------------------- similarity
class TestLevenshtein:
    def test_identical_is_zero(self):
        assert levenshtein_distance("zomato", "zomato") == 0

    def test_known_distances(self):
        assert levenshtein_distance("kitten", "sitting") == 3
        assert levenshtein_distance("zomato", "zomatoo") == 1
        assert levenshtein_distance("zomato", "zomaot") == 2

    def test_empty_strings(self):
        assert levenshtein_distance("", "abc") == 3
        assert levenshtein_distance("abc", "") == 3
        assert levenshtein_distance("", "") == 0

    def test_is_symmetric(self):
        assert levenshtein_distance("swiggy", "swigy") == levenshtein_distance("swigy", "swiggy")

    def test_case_and_whitespace_ignored(self):
        assert levenshtein_distance("  Zomato ", "zomato") == 0

    def test_cyrillic_o_counts_as_a_difference(self):
        assert levenshtein_distance("zomato", "z\u043emato") == 1  # Cyrillic о

    def test_similarity_bounds(self):
        assert levenshtein_similarity("zomato", "zomato") == 1.0
        assert levenshtein_similarity("abc", "xyz") == 0.0
        assert levenshtein_similarity("", "") == 1.0


class TestJaroWinkler:
    def test_identical_is_one(self):
        assert jaro_winkler_similarity("zomato", "zomato") == 1.0

    def test_no_overlap_is_zero(self):
        assert jaro_winkler_similarity("abc", "xyz") == 0.0

    def test_known_value(self):
        assert jaro_winkler_similarity("martha", "marhta") == pytest.approx(0.9611, abs=1e-4)

    def test_prefix_boost(self):
        # Same edit, but the shared prefix makes the first pair score higher.
        assert jaro_winkler_similarity("zomato", "zomatx") > jaro_winkler_similarity("zomato", "xomato")


class TestCombined:
    def test_identical_is_one(self):
        assert combined_similarity("zomato", "zomato") == 1.0

    def test_always_in_range(self):
        for a, b in [("zomato", "zomato_support"), ("a", ""), ("", ""), ("x" * 500, "y" * 500)]:
            assert 0.0 <= combined_similarity(a, b) <= 1.0

    def test_lookalike_scores_higher_than_unrelated(self):
        assert combined_similarity("zomato", "zomato_support") > combined_similarity("zomato", "amazon")
        assert combined_similarity("zomato", "zomatoo") > combined_similarity("zomato", "swiggy")

    def test_none_and_unicode_do_not_crash(self):
        assert combined_similarity(None, "zomato") == 0.0
        assert 0.0 <= combined_similarity("zomato", "zomato\U0001F355") <= 1.0

    def test_very_long_handle(self):
        assert 0.0 <= combined_similarity("zomato", "zomato" * 200) <= 1.0
