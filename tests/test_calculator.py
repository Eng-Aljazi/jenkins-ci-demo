"""
Unit tests for the calculator module.

Covers all four operations plus edge cases (zero division, negatives).
"""

import pytest

from calculator import add, divide, multiply, subtract


def test_add() -> None:
    """add() should return the sum of two numbers."""
    assert add(2, 3) == 5
    assert add(-1, 1) == 0


def test_subtract() -> None:
    """subtract() should return the difference of two numbers."""
    assert subtract(10, 4) == 6
    assert subtract(3, 7) == 4


def test_multiply() -> None:
    """multiply() should return the product of two numbers."""
    assert multiply(3, 4) == 12
    assert multiply(5, 0) == 0


def test_divide() -> None:
    """divide() should return the quotient of two numbers."""
    assert divide(10, 2) == 5
    assert divide(7, 2) == 3.5


def test_divide_by_zero_raises() -> None:
    """divide() should raise ValueError when dividing by zero."""
    with pytest.raises(ValueError, match="Cannot divide by zero"):
        divide(10, 0)


def test_add_negative_numbers() -> None:
    """add() should handle negative operands correctly."""
    assert add(-5, -3) == -8


def test_multiply_negative_numbers() -> None:
    """multiply() should handle negative operands correctly."""
    assert multiply(-2, 3) == -6


def test_subtract_from_zero() -> None:
    """subtract() should work when the first operand is zero."""
    assert subtract(0, 5) == -5
