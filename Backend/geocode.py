"""
geocode.py
Single-purpose module: turns a place name into (lat, lon) coordinates.

Why this exists as its own file: the code review flagged that the frontend's
map feature ("highlighted regions on the world map", "interactive evidence
markers") has nothing to plot from, because no coordinates are attached to
any agent output. Rather than bolting geocoding onto agent1.py directly,
it lives here so any agent (or a future map-focused agent) can reuse it
without duplicating HTTP/caching logic.

Uses Open-Meteo's free geocoding API (no API key required, no rate-limit
surprises for a hobby/dev project). Results are cached in-process since the
same place names (origins, common destinations) get looked up repeatedly
across requests within a running server.
"""
import logging
from functools import lru_cache
from typing import Optional, Tuple

import requests

log = logging.getLogger("sentinel.geocode")

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
REQUEST_TIMEOUT_SECONDS = 5


@lru_cache(maxsize=256)
def _geocode_lookup(query: str) -> Optional[Tuple[float, float]]:
    """Single raw lookup against Open-Meteo, cached per exact query string."""
    try:
        resp = requests.get(
            GEOCODE_URL,
            params={"name": query, "count": 1, "language": "en", "format": "json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
        if not results:
            return None
        top = results[0]
        return (top["latitude"], top["longitude"])
    except (requests.RequestException, KeyError, ValueError, IndexError) as exc:
        log.warning("geocode: lookup failed for %r (%s)", query, exc)
        return None


def geocode_place(place_name: str) -> Optional[Tuple[float, float]]:
    """Return (lat, lon) for a place name, or None if it can't be resolved.

    Tries the name as given first (e.g. "Rotterdam, Netherlands"). Open-Meteo's
    fuzzy match sometimes fails on a fully-qualified "City, Country" string for
    otherwise well-known cities but succeeds on the bare city name, so on a
    miss this retries with just the text before the first comma before giving
    up. Both lookups are individually cached, so repeated calls stay cheap.
    """
    if not place_name or not place_name.strip():
        return None

    cleaned = place_name.strip()
    coords = _geocode_lookup(cleaned)
    if coords is not None:
        return coords

    if "," in cleaned:
        bare_name = cleaned.split(",")[0].strip()
        if bare_name and bare_name.lower() != cleaned.lower():
            coords = _geocode_lookup(bare_name)
            if coords is not None:
                log.info("geocode: resolved %r via fallback bare name %r", cleaned, bare_name)
                return coords

    log.info("geocode: no match for %r (including fallback)", place_name)
    return None


def attach_coordinates(place_name: str) -> dict:
    """Convenience wrapper returning a dict ready to build a `Coordinates`
    model from (see models.py). Always returns both keys (None if the place
    couldn't be resolved) so callers never need extra branching:

        Coordinates(**attach_coordinates(stop_name))
    """
    coords = geocode_place(place_name)
    if coords is None:
        return {"lat": None, "lon": None}
    return {"lat": coords[0], "lon": coords[1]}