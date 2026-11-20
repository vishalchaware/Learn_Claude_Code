"""Unit tests for demo_pkg.utils.

Each public function in :mod:`demo_pkg.utils` is covered by a dedicated
``TestCase`` subclass.  Tests are grouped by function and named to
describe the specific behaviour under test.

Run with::

    pytest s05_todo_write/example/demo_pkg/tests/test_utils.py -v
"""

import pytest

from demo_pkg.utils import clamp, reverse_string, slugify


# ---------------------------------------------------------------------------
# reverse_string
# ---------------------------------------------------------------------------

class TestReverseString:
    """Tests for :func:`demo_pkg.utils.reverse_string`."""

    def test_regular_word(self) -> None:
        assert reverse_string("hello") == "olleh"

    def test_empty_string(self) -> None:
        assert reverse_string("") == ""

    def test_single_character(self) -> None:
        assert reverse_string("x") == "x"

    def test_palindrome_unchanged(self) -> None:
        assert reverse_string("racecar") == "racecar"

    def test_whitespace_preserved(self) -> None:
        assert reverse_string("hi there") == "ereht ih"

    def test_numeric_string(self) -> None:
        assert reverse_string("12345") == "54321"

    def test_returns_new_string(self) -> None:
        original = "abc"
        result = reverse_string(original)
        assert result is not original


# ---------------------------------------------------------------------------
# clamp
# ---------------------------------------------------------------------------

class TestClamp:
    """Tests for :func:`demo_pkg.utils.clamp`."""

    def test_value_within_bounds(self) -> None:
        assert clamp(5, 1, 10) == 5

    def test_value_below_lo(self) -> None:
        assert clamp(-3, 0, 100) == 0

    def test_value_above_hi(self) -> None:
        assert clamp(200, 0, 100) == 100

    def test_value_equals_lo(self) -> None:
        assert clamp(0, 0, 10) == 0

    def test_value_equals_hi(self) -> None:
        assert clamp(10, 0, 10) == 10

    def test_float_values(self) -> None:
        assert clamp(0.5, 0.0, 1.0) == 0.5

    def test_float_clamped_low(self) -> None:
        assert clamp(-0.1, 0.0, 1.0) == 0.0

    def test_float_clamped_high(self) -> None:
        assert clamp(1.1, 0.0, 1.0) == 1.0

    def test_lo_equals_hi(self) -> None:
        """When lo == hi the only valid return value is that single point."""
        assert clamp(7, 5, 5) == 5

    def test_lo_greater_than_hi_raises(self) -> None:
        with pytest.raises(ValueError, match="lo"):
            clamp(5, 10, 1)

    def test_negative_range(self) -> None:
        assert clamp(-5, -10, -1) == -5

    def test_return_type_int(self) -> None:
        result = clamp(3, 1, 10)
        assert isinstance(result, int)

    def test_return_type_float(self) -> None:
        result = clamp(3.0, 1.0, 10.0)
        assert isinstance(result, float)


# ---------------------------------------------------------------------------
# slugify
# ---------------------------------------------------------------------------

class TestSlugify:
    """Tests for :func:`demo_pkg.utils.slugify`."""

    def test_basic_phrase(self) -> None:
        assert slugify("Hello, World!") == "hello-world"

    def test_leading_trailing_spaces(self) -> None:
        assert slugify("  Python 3.12  ") == "python-3-12"

    def test_already_slug(self) -> None:
        assert slugify("already-a-slug") == "already-a-slug"

    def test_all_uppercase(self) -> None:
        assert slugify("UPPER CASE") == "upper-case"

    def test_numbers_preserved(self) -> None:
        assert slugify("v2 release") == "v2-release"

    def test_multiple_spaces_become_one_hyphen(self) -> None:
        assert slugify("too   many   spaces") == "too-many-spaces"

    def test_special_characters_removed(self) -> None:
        assert slugify("foo@bar.com") == "foo-bar-com"

    def test_leading_trailing_hyphens_stripped(self) -> None:
        assert slugify("---no hyphens at edges---") == "no-hyphens-at-edges"

    def test_only_special_characters_returns_empty(self) -> None:
        assert slugify("---") == ""

    def test_empty_string_returns_empty(self) -> None:
        assert slugify("") == ""

    def test_single_word(self) -> None:
        assert slugify("Python") == "python"

    def test_returns_string_type(self) -> None:
        assert isinstance(slugify("test"), str)
