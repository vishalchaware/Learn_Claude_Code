"""demo_pkg – a small demonstration package.

This package bundles lightweight string and numeric utility helpers that
are used throughout the ``learn-claude-code`` examples.

Public API
----------
The following names are re-exported from :mod:`demo_pkg.utils` for
convenient top-level access::

    from demo_pkg import reverse_string, clamp, slugify

Attributes:
    __version__: Package version string following *Semantic Versioning*.
    __all__: Explicit list of names exported when ``from demo_pkg import *``
        is used.
"""

from demo_pkg.utils import clamp, reverse_string, slugify

__version__: str = "0.1.0"
__all__: list[str] = ["reverse_string", "clamp", "slugify"]
