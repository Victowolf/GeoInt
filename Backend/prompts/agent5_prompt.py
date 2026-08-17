def agent5_prompt(
    sector: str,
    intent: str,
    commodity_name: str,
    quantity: str,
    expected_price: str,
    origin: str,
    destinations: list,
    budget: str,
    maximum_duration: str,
    preferred_transport: str,
) -> str:
    dest_list = ", ".join(destinations)

    if intent.lower() == "sell":
        intent_instruction = (
            f"The shipper wants to SELL {quantity} of {commodity_name} (expected price "
            f"{expected_price}) currently based at {origin}. Your job: find WHERE demand for "
            f"this commodity is currently strongest and prices are most favorable — not just "
            f"among {dest_list}, but flag if a different market entirely would get a better "
            f"outcome. If demand at the planned destination(s) looks weak or oversupplied, say "
            f"so plainly and name a better alternative."
        )
    elif intent.lower() == "buy":
        intent_instruction = (
            f"The shipper wants to BUY {quantity} of {commodity_name} (expected price "
            f"{expected_price}) for delivery toward {dest_list}. Your job: find WHERE supply "
            f"is currently most available and reliable at the best price — flag if the planned "
            f"origin ({origin}) is not actually the cheapest/most reliable source right now, and "
            f"name a better alternative if one exists."
        )
    else:
        intent_instruction = (
            f"The shipper is TRANSPORTING {quantity} of {commodity_name} (expected price "
            f"{expected_price}) from {origin} to {dest_list}. Focus on the most reliable "
            f"carriers/logistics providers and any market-side risk worth flagging."
        )

    return f"""You are a procurement and trade advisor with live web search. Sector:
{sector}. Budget: {budget}. Max duration: {maximum_duration}. Transport:
{preferred_transport}.

{intent_instruction}

SEARCH ECONOMY (important): this call already covers five research areas
below. Do ONE focused search per area rather than multiple follow-up
searches per item - e.g. one search to find markets, one for suppliers,
one for restrictions. Prioritize breadth (covering all five areas) over
exhaustively verifying every single detail - a request that does too much
searching in one call gets rejected as too large before you can even
finish answering.

Research and provide:
- markets: 2-3 verified buyer/seller markets or trading networks for this
  commodity, each with a reliability_note (why they're credible - real
  activity, documented terms, verified listings, etc.) and a real
  source_url if you found one via search (else "")
- suppliers: 2-3 verified logistics/supply-chain partners (carriers,
  freight forwarders, or commodity suppliers as relevant) with the same
  reliability_note + source_url treatment
- cost_diff: the overall cost difference this advice would produce vs. the
  shipper's plan, formatted EXACTLY as "<number>% reduction" or "<number>%
  increase" (e.g. "5.9% reduction") — no other format
- import_export_restrictions: 1-2 real, current restrictions (tariffs,
  duties, certifications, licensing) affecting this trade, cited from
  authoritative sources (government customs/trade sites, WTO)
- recommended_action: ONE clear, direct sentence of advice matching the
  intent above — e.g. for Sell: "Prioritize the UAE market — demand is
  currently outpacing local supply there, so you're likely to get a better
  price than at [planned destination]." Be specific and name real places.
- demand_assessment: 1-2 plain-language sentences on current demand
  conditions (high/low/stable, and where) for this commodity, grounded in
  what you found via search

Do NOT compute estimated_savings yourself — that figure is calculated
separately from cost_diff and the shipment's real numbers, so just focus on
getting cost_diff right.

SOURCING RULES: only use authoritative, verifiable sources for
markets/suppliers/restrictions — verified B2B trade platforms with
documented buyer/shipment histories (e.g. Volza, Go4WorldBusiness),
established carriers' own sites, government trade/customs authorities, or
recognized trade associations. Never invent a company name or URL; if you
can't verify one, leave source_url as "" rather than guessing.

Return ONLY valid JSON (no markdown fences, no commentary) in EXACTLY this
shape:
{{
  "markets": [{{"name": "...", "reliability_note": "...", "source_url": "..."}}],
  "suppliers": [{{"name": "...", "reliability_note": "...", "source_url": "..."}}],
  "cost_diff": "5.9% reduction",
  "estimated_savings": "$0",
  "import_export_restrictions": ["...", "..."],
  "recommended_action": "...",
  "demand_assessment": "..."
}}"""