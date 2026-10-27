"""Nearby hospitals / clinics from OpenStreetMap (Overpass API) - free, no API key.

Results use the same shape the React app already renders for Google Maps grounding:
    {"maps": {"title": ..., "uri": <Google Maps directions link>, "placeId": None, ...}}
so the "Directions" buttons open Google Maps with the hospital pre-filled as destination.
"""
import logging
import math
from typing import Optional

import httpx

log = logging.getLogger("medpredict.places")

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
RADII_M = [5_000, 15_000, 40_000]   # widen the search until we have enough results
MIN_RESULTS = 3
MAX_RESULTS = 8
HEADERS = {"User-Agent": "MedPredict-AI/1.0 (healthcare portfolio project)"}


class CareLookupError(RuntimeError):
    """Every Overpass server failed or timed out."""


def _filters(specialization: str) -> list[str]:
    """Pick OpenStreetMap tag filters for the requested kind of care."""
    s = specialization.lower()
    if "dent" in s:
        return ['["amenity"="dentist"]']
    if "pediatr" in s or "paediatr" in s or "child" in s:
        return ['["healthcare:speciality"~"paediatrics|pediatrics"]', '["amenity"="hospital"]']
    if "emergency" in s or "trauma" in s:
        return ['["amenity"="hospital"]']
    if s.strip() in {"clinic", "doctor", "gp", "general"}:
        return ['["amenity"="clinic"]', '["amenity"="doctors"]']
    # A condition name (e.g. "Viral Illness") or any other specialty: hospitals + clinics.
    return ['["amenity"="hospital"]', '["amenity"="clinic"]']


def _build_query(specialization: str, lat: float, lng: float, radius_m: int) -> str:
    parts = "".join(f"nwr{f}(around:{radius_m},{lat},{lng});" for f in _filters(specialization))
    return f"[out:json][timeout:20];({parts});out center tags 80;"


async def _query_overpass(query: str) -> list[dict]:
    last: Optional[Exception] = None
    async with httpx.AsyncClient(timeout=25, headers=HEADERS) as client:
        for url in OVERPASS_URLS:
            try:
                resp = await client.post(url, data={"data": query})
                resp.raise_for_status()
                return resp.json().get("elements", [])
            except Exception as exc:  # try the next mirror
                log.warning("Overpass server %s failed: %s", url, exc)
                last = exc
    raise CareLookupError("Could not reach the hospital search service.") from last


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _parse(elements: list[dict], lat: float, lng: float) -> list[dict]:
    found: dict[tuple, dict] = {}
    for el in elements:
        tags = el.get("tags") or {}
        name = (tags.get("name") or "").strip()
        e_lat = el.get("lat", (el.get("center") or {}).get("lat"))
        e_lng = el.get("lon", (el.get("center") or {}).get("lon"))
        if not name or e_lat is None or e_lng is None:
            continue
        key = (name.lower(), round(e_lat, 3), round(e_lng, 3))  # same place mapped twice
        if key in found:
            continue
        address = ", ".join(
            p for p in (
                " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x),
                tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
                tags.get("addr:city"),
            ) if p
        )
        found[key] = {
            "maps": {
                "title": name,
                "uri": f"https://www.google.com/maps/dir/?api=1&destination={e_lat},{e_lng}&travelmode=driving",
                "placeId": None,
                "distanceKm": round(_distance_km(lat, lng, e_lat, e_lng), 1),
                "address": address,
                "kind": tags.get("amenity", ""),
                "emergency": tags.get("emergency") == "yes",
                "phone": tags.get("phone") or tags.get("contact:phone") or "",
            }
        }
    return sorted(found.values(), key=lambda link: link["maps"]["distanceKm"])


async def find_nearby_care(specialization: str, lat: float, lng: float) -> dict:
    links: list[dict] = []
    radius = RADII_M[-1]
    for radius in RADII_M:
        elements = await _query_overpass(_build_query(specialization, lat, lng, radius))
        links = _parse(elements, lat, lng)
        if len(links) >= MIN_RESULTS:
            break
    links = links[:MAX_RESULTS]
    if not links:
        text = f"No {specialization.lower()} facilities found within {radius // 1000} km on OpenStreetMap."
    else:
        text = (f"Found {len(links)} nearby option{'s' if len(links) != 1 else ''} within "
                f"{radius // 1000} km, closest first.")
    return {"text": text, "links": links}
