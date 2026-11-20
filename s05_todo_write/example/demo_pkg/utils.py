"""Utility helpers for demo_pkg.

This module provides three small, pure utility functions:

* :func:`reverse_string` – reverse the characters in a string.
* :func:`clamp`          – constrain a number within [lo, hi].
* :func:`slugify`        – convert a phrase into a URL-safe slug.

All functions carry full type hints and Google-style docstrings, and are
safe to import without side-effects.
"""

import re


def reverse_string(text: str) -> str:
    """Return *text* with its characters in reverse order.

    Args:
        text: The string to reverse. May be empty.

    Returns:
        A new string that is the reverse of *text*.

    Examples:
        >>> reverse_string("hello")
        'olleh'
        >>> reverse_string("")
        ''
        >>> reverse_string("a")
        'a'
    """
    return text[::-1]


def clamp(value: float, lo: float, hi: float) -> float:
    """Constrain *value* to the closed interval [*lo*, *hi*].

    Args:
        value: The number to clamp.
        lo: The inclusive lower bound.
        hi: The inclusive upper bound.

    Returns:
        *lo* if ``value < lo``, *hi* if ``value > hi``, otherwise *value*.

    Raises:
        ValueError: If *lo* is greater than *hi*.

    Examples:
        >>> clamp(5, 1, 10)
        5
        >>> clamp(-3, 0, 100)
        0
        >>> clamp(200, 0, 100)
        100
        >>> clamp(0.5, 0.0, 1.0)
        0.5
    """
    if lo > hi:
        raise ValueError(f"lo ({lo}) must not be greater than hi ({hi})")
    return max(lo, min(value, hi))


def slugify(phrase: str) -> str:
    """Convert *phrase* into a lowercase, hyphen-separated URL slug.

    The transformation pipeline is:

    1. Strip leading / trailing whitespace.
    2. Convert to lowercase.
    3. Replace any run of non-alphanumeric characters with a single ``-``.
    4. Strip any leading or trailing ``-`` characters.

    Args:
        phrase: Arbitrary human-readable text to slugify.

    Returns:
        A URL-safe slug string.  Returns an empty string if *phrase*
        contains no alphanumeric characters.

    Examples:
        >>> slugify("Hello, World!")
        'hello-world'
        >>> slugify("  Python 3.12  ")
        'python-3-12'
        >>> slugify("café & résumé")
        'caf-r-sum'
        >>> slugify("---")
        ''
    """
    lowered: str = phrase.strip().lower()
    slug: str = re.sub(r"[^a-z0-9]+", "-", lowered)
    return slug.strip("-")
