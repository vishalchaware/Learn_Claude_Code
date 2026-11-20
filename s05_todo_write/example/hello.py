"""Greeting module that provides a simple hello-world style greeting utility.

This module exposes two public helpers:

* ``build_greeting`` – pure function that constructs a greeting string.
* ``greet``          – convenience wrapper that prints the greeting to stdout.

Typical usage::

    from hello import greet
    greet("Alice")          # Hello, Alice!

    from hello import build_greeting
    msg: str = build_greeting("Bob")
    print(msg.upper())      # HELLO, BOB!
"""


def build_greeting(name: str) -> str:
    """Return a formatted greeting string without printing it.

    This is a pure function: it has no side-effects and always returns the
    same value for the same *name*.

    Args:
        name: The name of the person (or thing) to greet.

    Returns:
        A greeting string of the form ``"Hello, <name>!"``.

    Raises:
        ValueError: If *name* is an empty string.

    Examples:
        >>> build_greeting("World")
        'Hello, World!'
        >>> build_greeting("Claude")
        'Hello, Claude!'
    """
    if not name:
        raise ValueError("name must not be empty")
    return f"Hello, {name}!"


def greet(name: str) -> None:
    """Print a personalised greeting message to stdout.

    Delegates message construction to :func:`build_greeting` so that
    formatting logic lives in exactly one place.

    Args:
        name: The name of the person (or thing) to greet.

    Raises:
        ValueError: If *name* is an empty string (propagated from
            :func:`build_greeting`).

    Examples:
        >>> greet("World")
        Hello, World!
    """
    message: str = build_greeting(name)
    print(message)


def main() -> None:
    """Entry point for running the module as a script.

    Demonstrates both public helpers with a sample name and exercises the
    ``ValueError`` guard so the behaviour is visible when the file is
    executed directly.

    Examples:
        $ python hello.py
        Hello, Claude!
        HELLO, CLAUDE!
    """
    sample_name: str = "Claude"

    # Demonstrate greet() – prints directly.
    greet(sample_name)

    # Demonstrate build_greeting() – manipulate the string before printing.
    message: str = build_greeting(sample_name)
    print(message.upper())


if __name__ == "__main__":
    main()
