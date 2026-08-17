"""
money.py
Parses free-text money/quantity/percentage strings (from both user input and
LLM output) into real numbers, so downstream math is computed in Python
instead of trusted to LLM arithmetic.

Why this exists: a live bug traced back to exactly this gap. Agent 5
returned cost_diff = "2.5% reduction" on a $250,000 budget, but
estimated_savings = "$5" - because the LLM was asked to independently
invent both numbers instead of one being derived from the other. Every
function here is intentionally permissive (handles $/€/£/₹/¥, commas,
ranges, unit suffixes like "barrels"/"per unit") since it has to parse both
user-typed free text and LLM-generated free text, neither of which is
guaranteed to be clean.

This revision adds compute_scenario_cost_amount(), used by Agent 2: the
same principle applied to scenario cost_impact - a bare "12% increase"
means nothing to a reader until it's turned into "that's roughly $X on your
stated budget of $Y."
"""
import re
import logging
from typing import Optional, Tuple

log = logging.getLogger("sentinel.money")

_NUMBER_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
_CURRENCY_SYMBOLS = ["$", "€", "£", "₹", "¥"]


def parse_number(text: str) -> Optional[float]:
    """Extract the first numeric value from a free-text string.
    "$250,000" -> 250000.0, "50,000 barrels" -> 50000.0,
    "$40,000-$45,000" -> 40000.0 (leftmost/lower bound of a range, treated
    conservatively), "N/A" -> None."""
    if not text:
        return None
    match = _NUMBER_RE.search(text)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def detect_currency(*texts: str) -> str:
    """Return the first currency symbol found across the given strings,
    defaulting to "$" if none is present."""
    for text in texts:
        if not text:
            continue
        for symbol in _CURRENCY_SYMBOLS:
            if symbol in text:
                return symbol
    return "$"


def parse_cost_diff(cost_diff: str) -> Optional[Tuple[float, str]]:
    """Parse "9.7% reduction" / "12% increase" -> (9.7, "reduction").
    Returns None if the string doesn't match the expected shape (should be
    rare, since Agent5Output already validates this format server-side, but
    this stays defensive for direct/standalone calls)."""
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)%\s*(reduction|increase)\s*", cost_diff or "", re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1)), match.group(2).lower()


def compute_estimated_savings(
    cost_diff: str, quantity: str, expected_price: str, budget: str
) -> Tuple[Optional[str], str]:
    """Compute estimated_savings server-side instead of trusting the LLM's
    own arithmetic.

    Preference order for the base amount cost_diff% is applied against:
      1. quantity x expected_price (the actual commodity order value) -
         most meaningful, since procurement savings are about the trade
         itself, not the logistics/shipping budget.
      2. budget - fallback if quantity/expected_price don't parse cleanly.
      3. Neither parses -> returns (None, <explanatory basis>) so the
         caller can fall back to whatever the LLM originally produced,
         clearly labeled as an unverified AI estimate rather than silently
         presenting it with the same authority as a computed number.

    Returns (formatted_amount_or_None, human_readable_basis_string).
    """
    parsed = parse_cost_diff(cost_diff)
    currency = detect_currency(expected_price, budget)

    if parsed is None:
        return None, "unverified — cost_diff was not in the expected '<number>% reduction|increase' format"

    pct, _direction = parsed
    qty = parse_number(quantity)
    price = parse_number(expected_price)

    if qty is not None and price is not None:
        order_value = qty * price
        amount = order_value * (pct / 100)
        basis = (
            f"computed as {pct:g}% of order value "
            f"({currency}{order_value:,.2f} = {qty:,.0f} x {currency}{price:,.2f}/unit)"
        )
        return f"{currency}{amount:,.2f}", basis

    budget_val = parse_number(budget)
    if budget_val is not None:
        amount = budget_val * (pct / 100)
        basis = (
            f"computed as {pct:g}% of stated budget ({currency}{budget_val:,.2f}) — "
            f"quantity/expected_price could not be parsed as numbers, so order value was unavailable"
        )
        return f"{currency}{amount:,.2f}", basis

    return None, (
        "unverified — could not parse numeric values from quantity, expected_price, or budget; "
        "estimated_savings is the AI's own unverified estimate, not a computed figure"
    )


def compute_scenario_cost_amount(
    fraction_value: float, impact_type: str, budget: str, estimated_delays: str = ""
) -> Tuple[str, str]:
    """Turn Agent 2's fractional cost_impact.value (e.g. 0.12 for "12%") into
    an actual dollar figure against the shipment's own stated budget, plus a
    one-line plain-language note a non-expert reader can act on.

    Returns (formatted_amount_or_empty_string, plain_language_note). Both
    are "" if budget doesn't parse to a number - callers should leave the
    LLM's original percentage as the only figure shown in that case, rather
    than fabricate a dollar amount from nothing.

    Defense in depth: models.py's CostImpact validator should already catch
    a fraction_value that isn't really a fraction (e.g. the model returning
    25000 instead of 0.25), but that validator only runs when a caller
    wires it up via get_structured_response(..., validate=...). This
    function refuses to multiply against an out-of-range value regardless,
    so a bad number can never turn into a headline like "$6,250,000,000.00
    in additional cost on a $250,000 budget" even if the upstream check is
    ever skipped, misconfigured, or bypassed by a direct/standalone call.
    """
    budget_val = parse_number(budget)
    currency = detect_currency(budget)

    if budget_val is None or fraction_value is None:
        return "", ""

    if not (0.0 <= fraction_value <= 5.0):
        log.warning(
            "compute_scenario_cost_amount: refusing to compute - fraction_value=%r is not a "
            "plausible fraction (expected 0.0-5.0); this usually means the LLM returned a raw "
            "number/percentage instead of a fraction",
            fraction_value,
        )
        return "", (
            f"unverified — the model's cost_impact value ({fraction_value}) wasn't a plausible "
            f"fraction of the budget, so no dollar figure could be safely computed"
        )

    amount = budget_val * fraction_value
    is_increase = (impact_type or "").strip().lower() == "increase"
    verb = "additional cost" if is_increase else "potential savings"
    verdict = "you might face" if is_increase else "you could gain"

    note = (
        f"If this scenario happens, {verdict} roughly {currency}{amount:,.2f} in {verb} "
        f"on your stated budget of {currency}{budget_val:,.2f}"
    )
    if estimated_delays:
        note += f", plus a likely delay of {estimated_delays}"
    note += "."

    return f"{currency}{amount:,.2f}", note