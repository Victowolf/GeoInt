def agent4_prompt(
    risk_score: float,
    destination_statuses: list,
    supply_chain_analysis: str,
    least_risk_route: dict,
) -> str:
    stops_summary = "\n".join(
        f"- {d.get('destination')}: {d.get('present_status')} — {d.get('source', {}).get('content', '')}"
        for d in destination_statuses
    )

    return f"""You are the lead risk advisor delivering a final shipment verdict. You
have already gathered the following intelligence yourself (this is YOUR own
research and analysis — do not refer to it as coming from separate systems,
"agents", "models", "reports", or "the data provided"; write as a single
expert who did all of this work and is now giving their professional
recommendation):

OVERALL ROUTE RISK SCORE: {risk_score:.2f} (0 = no concern, 1 = extremely
dangerous)

SITUATION AT EACH STOP:
{stops_summary}

SUPPLY CHAIN OUTLOOK:
{supply_chain_analysis}

BEST ALTERNATIVE ROUTE IDENTIFIED (if the current route is used, the
default plan below is what's currently under evaluation):
{least_risk_route}

Now give your final recommendation. Choose exactly one:
"Proceed" | "Caution" | "Wait" | "Use Alternate Route"

Write "reason" as 2-4 short bullet-style sentences and "factors" as 3-5
short phrases — both written in first-person-expert, plain, confident
language, as if you are the analyst signing off on this decision. Do NOT
write phrases like "Agent 1 found", "according to the data", "based on the
report" — instead say things like "The port situation at X is currently
stable," or "Escalating tension near Y is the main driver of this call."

Also give a "confidence" score (0.0-1.0) reflecting how much the evidence
above is aligned (consistent, low-ambiguity evidence = high confidence;
mixed or thin evidence = lower confidence).

If your suggestion is "Wait", you MUST also give "wait_duration" (e.g. "5-7
days") — omit it entirely otherwise.

Return ONLY valid JSON (no markdown fences, no commentary) in EXACTLY this
shape:
{{
  "suggestion": "Proceed" | "Caution" | "Wait" | "Use Alternate Route",
  "wait_duration": "<only if suggestion is Wait, else omit this key>",
  "confidence": 0.0,
  "reason": ["...", "..."],
  "factors": ["...", "..."]
}}"""
