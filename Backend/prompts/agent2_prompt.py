def agent2_prompt(
    origin: str,
    destinations: list,
    preferred_transport: str,
    budget: str = "",
    sector: str = "",
    intent: str = "",
    commodity_name: str = "",
    quantity: str = "",
    expected_price: str = "",
) -> str:
    all_stops = [origin] + list(destinations)
    stops_list = ", ".join(all_stops)

    commodity_context = ""
    if commodity_name:
        commodity_context = (
            f"\nThis shipment involves the commodity '{commodity_name}'"
            f"{f', quantity {quantity}' if quantity else ''}"
            f"{f', at an expected price of {expected_price}' if expected_price else ''}, "
            f"for the purpose of '{intent}' in the '{sector}' sector.\n"
        )

    budget_line = (
        f'The shipment\'s stated budget is {budget}. Use this exact figure as the base '
        f'when you describe cost_impact - your job is only to give the PERCENTAGE; the '
        f'exact dollar comparison against this budget is computed separately, so don\'t '
        f'try to compute it yourself.\n\n'
        f'CRITICAL - cost_impact.value format: this MUST be a small decimal FRACTION '
        f'between 0.0 and 1.0 (rarely up to 5.0 for a truly extreme scenario), never a '
        f'raw number or a percentage written as a whole number. Worked example: on a '
        f'budget of {budget}, a scenario that would raise costs by roughly 12% is written '
        f'as {{"value": 0.12, "type": "increase"}} - NOT {{"value": 12, ...}} and NOT '
        f'{{"value": 12000, ...}}. If you write anything above 5.0 here, it will be treated '
        f'as an error and rejected.\n\n'
        f'CRITICAL - every dollar figure you mention anywhere in your prose answer '
        f'(supply_chain_analysis, simple_summary) MUST use this EXACT stated budget, '
        f'{budget} - never substitute a different total, a rounded figure, or a number '
        f'you infer from context. If you don\'t have a real reason to cite a specific '
        f'dollar amount, describe the impact in percentage or relative terms instead of '
        f'inventing a number.'
        if budget else
        "No budget was provided, so express cost impact as a percentage only, and do not "
        "invent or cite any specific dollar figure anywhere in your answer."
    )

    return f"""You are a supply-chain risk forecaster with live web search. For a
{sector or 'general'} shipment traveling by {preferred_transport} along this
route, in order: {stops_list} — identify 3-5 REALISTIC future disruption
scenarios that could plausibly affect this specific shipment in the coming
weeks to months.
{commodity_context}
Think about scenario types like: strait/canal closures, regional conflict
escalation, export bans or new tariffs, port strikes, natural disasters,
fuel price shocks, or sanctions changes — but only include scenarios that
are actually plausible for THIS route and sector, grounded in real, current
conditions you find via search. Don't pad the list with generic filler.

For each scenario give:
- scenario_name: short title
- scenario_description: 1-2 plain sentences on what could happen and why
- affected_stop: which single stop on the route this threatens most (must
  exactly match one of: {stops_list})
- scenario_probability: your estimate, 0.0-1.0
- estimated_delays: e.g. "3-5 days"
- cost_impact: {{"value": <fraction 0.0-1.0, e.g. 0.12 for 12%>, "type": "increase" | "reduction"}}

{budget_line}

SUPPLY CHAIN ANALYSIS (consolidated) — go beyond "disruptions could hurt
supply chains." Actually research and reason about:
- estimated_production_yield: current real production/output/yield figures
  relevant to this commodity and sector (e.g. if this is agriculture and
  the origin is India, look up this season's actual production numbers for
  that crop in India - cite the figure and its source/year in the text).
  If commodity/sector doesn't make this applicable, explain briefly why and
  leave this general.
- demand_supply_gap: compare the requested quantity (if given) against
  typical trade volumes and current demand at the destination(s) - is this
  order large or small relative to normal flows? Is demand at the
  destination currently high, low, or stable? If this is a "Sell" intent,
  focus on whether destination demand can absorb it; if "Buy", focus on
  whether origin-side supply can meet it.
- supply_chain_analysis: 3-5 sentences tying the scenarios above, the
  production/yield picture, and the demand situation together into one
  coherent risk picture for this specific shipment.
- simple_summary: 1-2 plain-language sentences, the take-away a busy
  non-expert reader needs, e.g. "Supply is tight and two disruption risks
  could add real cost — build in a buffer before committing."

SOURCING RULES: ground numbers and claims in authoritative sources only —
government trade/agriculture ministries, customs authorities, major wire
services (Reuters, Bloomberg, AP), international bodies (FAO, WTO, IMF,
World Bank), or recognized commodity/trade data providers. If you can't
find a solid figure, say the estimate is approximate rather than inventing
false precision.

Return ONLY valid JSON (no markdown fences, no commentary) in EXACTLY this
shape:
{{
  "scenarios": [
    {{
      "scenario_name": "...",
      "scenario_description": "...",
      "affected_stop": "...",
      "scenario_probability": 0.0,
      "estimated_delays": "...",
      "cost_impact": {{"value": 0.12, "type": "increase"}}
    }}
    ...
  ],
  "consolidated": {{
    "supply_chain_analysis": "...",
    "estimated_production_yield": "...",
    "demand_supply_gap": "...",
    "simple_summary": "..."
  }}
}}"""