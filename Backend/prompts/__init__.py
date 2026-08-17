"""
prompts/
All LLM prompts live here, one file per agent, so wording can be tuned
without touching agent logic in agent1.py..agent5.py. Every prompt ends
with an explicit JSON schema instruction - the field names below MUST match
the corresponding Pydantic model in models.py exactly, since agent*.py
parses the reply straight into that model.
"""
