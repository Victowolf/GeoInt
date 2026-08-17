def agent3_prompt(
    origin: str,
    destinations: list,
    mandatory_checkpoints: list,
    preferred_transport: str,
    budget: str,
    maximum_duration: str,
) -> str:
    checkpoint_pairs = ", ".join(
        f"{dest} (mandatory)" if flag else f"{dest} (optional)"
        for dest, flag in zip(destinations, mandatory_checkpoints)
    )

    return f"""You are a logistics route optimizer. The shipper's planned route starts at
{origin} and must reach: {checkpoint_pairs}, using {preferred_transport}
transport, within a budget of {budget} and a maximum duration of
{maximum_duration}.

Propose 3-5 realistic ALTERNATIVE routes (different stop sequences and/or
different intermediate stops) that still start at {origin}, still visit
every stop marked "(mandatory)" above, and respect the transport mode. You
may add, remove, or reorder optional stops and add reasonable intermediate
waypoints (e.g. a transshipment hub) if that genuinely improves the route.

For EACH alternative route, give:
- destinations: full ordered stop list after the origin. If you add an
  intermediate waypoint (e.g. a transshipment hub or a strait/canal you
  route through), it MUST be added here, as its own entry in this list —
  never omit it from "destinations" and never put its name anywhere else.
- mandatory_checkpoints: a flag per destination, SAME LENGTH and SAME ORDER
  as your destinations list, and EVERY value must be the INTEGER 1 or the
  INTEGER 0 — never a place name, never a string, never anything else.
  1 = must-visit (carried over from the original mandatory stops), 0 =
  optional (either an original optional stop or a waypoint you added).
  Example: if destinations = ["Suez Canal", "Rotterdam"], and only
  Rotterdam was originally mandatory, then mandatory_checkpoints MUST be
  [0, 1] — NOT ["Suez Canal", "Rotterdam"].
- risk_score: your estimate of THIS route's geopolitical/logistics risk,
  0.0 (very safe) to 1.0 (very risky) — vary these meaningfully across your
  alternatives, don't just repeat similar numbers. This field, along with
  estimated_cost, estimated_duration, and explanation below, is REQUIRED on
  every single route — never omit any of them, even for a route you
  personally think is worse than the others.
- estimated_cost: a realistic dollar figure or range for this route
- estimated_duration: a realistic day range for this route
- explanation: 1-2 plain-language sentences on WHY this route sits where it
  does — what makes it cheaper/riskier/slower or safer/faster/pricier than
  the others, in terms a non-logistics person understands (e.g. "Skips the
  congested Suez corridor, so it's slower but avoids the current transit
  delays there.")

Then write "consolidated.simple_summary": a short plain-language paragraph
that explicitly explains, for someone unfamiliar with logistics jargon:
  1. what "risk_score" means here (lower = safer)
  2. what "estimated_cost" and "estimated_duration" represent
  3. which of your proposed routes you'd recommend and why, weighing risk,
     cost, and time together — not just picking the cheapest or the fastest
Also set "consolidated.recommended_route_index" to the 0-based index (into
your "alternative_routes" list) of the route you recommend.

Finally, fill "consolidated.glossary" with a ONE-LINE plain-language
definition for each of the three table columns below, written so a reader
seeing the alternative_routes table for the first time (no logistics
background) immediately understands what each column means without reading
simple_summary:
  - "risk_score": e.g. "How risky this route is right now, from 0 (very
    safe) to 1 (very risky) — lower is better."
  - "estimated_cost": e.g. "The rough total shipping cost for this route,
    including transport and handling."
  - "estimated_duration": e.g. "How many days this route is expected to
    take from {origin} to final delivery."
(Reword these to fit the actual route/numbers — don't copy the examples
verbatim.)

Return ONLY valid JSON (no markdown fences, no commentary) in EXACTLY this
shape, with EVERY field present on EVERY route (no omissions) and
mandatory_checkpoints as integers ONLY:
{{
  "alternative_routes": [
    {{
      "origin": "{origin}",
      "destinations": ["...", "..."],
      "mandatory_checkpoints": [1, 0],
      "risk_score": 0.0,
      "estimated_cost": "$X-$Y",
      "estimated_duration": "N-M days",
      "explanation": "..."
    }}
    ...
  ],
  "consolidated": {{
    "simple_summary": "...",
    "recommended_route_index": 0,
    "glossary": {{
      "risk_score": "...",
      "estimated_cost": "...",
      "estimated_duration": "..."
    }}
  }}
}}"""