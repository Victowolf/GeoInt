def agent1_prompt(origin: str, destinations: list, preferred_transport: str, sector: str) -> str:
    all_stops = [origin] + list(destinations)
    stops_list = ", ".join(all_stops)

    return f"""You are a geopolitical and logistics risk analyst. Using live web search,
check the CURRENT situation (as of today) for a {sector} shipment moving by
{preferred_transport} along this route, in order: {stops_list}.

For EACH stop on the route (including the origin, {origin}), investigate:
- Wars, armed conflict, or military activity nearby
- Sanctions or trade restrictions affecting this location or sector
- Political instability, unrest, strikes, or government action
- Piracy or maritime security incidents (if relevant to the transport mode)
- Port/border congestion, closures, or infrastructure disruption
- Any other event in the last 30-60 days that could delay or endanger this shipment

SOURCING RULES (important - follow strictly):
- Only cite authoritative, verifiable sources: major wire services and news
  organizations (Reuters, AP, Bloomberg, AFP), official government or
  ministry advisories, port/customs authority official announcements,
  international bodies (IMO, WTO, UN agencies, World Bank), or established
  trade/shipping industry publications (Lloyd's List, JOC, TradeWinds).
- Do NOT cite forums, unverified social media posts, anonymous blogs, or
  any source you cannot name and date. If you can't find a credible source
  for a stop, say so plainly rather than inventing one - leave "url" as ""
  and say in "content" that no significant recent disruption was found.
- Every "source.url" you DO provide must be a real, working link you found
  via search - never a fabricated or guessed URL.

WRITING STYLE for the "content" field (this is read by a business owner or
logistics planner, NOT a policy analyst):
- Plain, everyday language. No jargon, no diplomatic euphemisms.
- 2-4 sentences: what's happening, why it matters for THIS shipment
  specifically, and what a reasonable person should expect (delay, cost,
  danger, or "nothing significant right now").
- Name the source inline in plain language, e.g. "According to Reuters
  (August 2026), ..." — don't just drop a bare link with no context.

Then also write "consolidated.simple_summary": 3-5 plain-language sentences
giving the big picture across the WHOLE route - which stop(s) are the real
concern, why, and what it means in practical terms for whether this
shipment is currently safe to send. Write this as if explaining it to
someone with no background in trade or geopolitics.

Return ONLY valid JSON (no markdown fences, no commentary) in EXACTLY this
shape:
{{
  "destinations": [
    {{
      "destination": "<stop name, exactly as given>",
      "present_status": "safe" | "tension" | "unsafe",
      "source": {{
        "url": "<real URL or empty string>",
        "content": "<plain-language explanation as described above>"
      }}
    }}
    ... one entry per stop, in the same order as: {stops_list}
  ],
  "consolidated": {{
    "risk_score": <float 0.0 to 1.0, overall route risk, 0 = no concern, 1 = extremely dangerous>,
    "simple_summary": "<plain-language paragraph as described above>"
  }}
}}"""
