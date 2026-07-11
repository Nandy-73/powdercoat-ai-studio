"""Machinery intelligence ingestion.

Reads admin-configured source pages and proposes new machines as suggestions
that a human approves before they enter the live database.

Extraction has two modes:
  * heuristic (default) — keyword + regex parsing, works with no API key or cost
  * ai (optional)       — if settings.LLM_API_KEY is set, an LLM extracts
                          structured machine records; falls back to heuristic on error
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.machinery import IngestionSource, Machine, MachineSuggestion

logger = get_logger("machinery_intel")

# Machine-type keywords -> normalized type used across the app
_TYPE_KEYWORDS = {
    "extruder": "extruder",
    "twin-screw": "extruder",
    "twin screw": "extruder",
    "kneader": "extruder",
    "mixer": "mixer",
    "premixer": "mixer",
    "blender": "mixer",
    "cooling": "cooling_system",
    "chill roll": "cooling_system",
    "chiller": "cooling_system",
    "crusher": "crusher",
    "pre-crusher": "crusher",
    "grinding": "grinding",
    "acm mill": "grinding",
    "classifier mill": "grinding",
    "mill": "grinding",
    "sieve": "sieving",
    "sieving": "sieving",
    "screener": "sieving",
    "packaging": "packaging",
    "filling": "packaging",
    "bagging": "packaging",
    "spectrophotometer": "laboratory",
    "gloss meter": "laboratory",
    "salt spray": "laboratory",
    "spray booth": "laboratory",
    "lab ": "laboratory",
}

_CAPACITY_RE = re.compile(r"(\d[\d,\.]*)\s*(kg\s*/\s*h|kg/hr|kg per hour|kg|l\b|liters?|litres?|t/h)", re.I)
_PRICE_RE = re.compile(r"(?:US\$|USD|\$|€|EUR)\s?([\d][\d,\.]*)\s*(k|thousand|million|m)?", re.I)
_ENERGY_RE = re.compile(r"(\d[\d,\.]*)\s*(kw|kilowatt)", re.I)


class _TextExtractor(HTMLParser):
    """Strip HTML to readable text, skipping script/style."""

    def __init__(self) -> None:
        super().__init__()
        self._skip = False
        self.chunks: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            text = data.strip()
            if text:
                self.chunks.append(text)


def _html_to_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)
    return "\n".join(parser.chunks)


def _http_get(url: str) -> str:
    """Fetch a page. Uses verified TLS first; if the local network does SSL
    inspection (certificate verify failure), retries once without verification
    so the feature still works behind corporate proxies / antivirus."""
    headers = {"User-Agent": "PowderCoatAI-MachineryBot/1.0"}
    try:
        resp = httpx.get(url, timeout=25, follow_redirects=True, headers=headers)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:  # noqa: BLE001
        if "CERTIFICATE" in str(exc).upper() or "SSL" in str(exc).upper():
            logger.warning("TLS verify failed for %s — retrying without verification", url)
            resp = httpx.get(url, timeout=25, follow_redirects=True, headers=headers, verify=False)
            resp.raise_for_status()
            return resp.text
        raise


def _num(raw: str) -> float:
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return 0.0


def _classify(sentence: str) -> str | None:
    low = sentence.lower()
    for kw, mtype in _TYPE_KEYWORDS.items():
        if kw in low:
            return mtype
    return None


def extract_machines_heuristic(text: str, source_name: str, source_url: str) -> list[dict]:
    """Split text into sentences, keep those that mention a machine type, and
    pull capacity / price / energy where present."""
    sentences = re.split(r"(?<=[\.\!\?\n])\s+", text)
    found: list[dict] = []
    seen: set[str] = set()

    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 15 or len(sent) > 400:
            continue
        mtype = _classify(sent)
        if not mtype:
            continue

        # A rough "name": the machine type phrase + any nearby model token (e.g. ZSK-26)
        model = re.search(r"\b([A-Z][A-Za-z]*[-\s]?\d{1,4}[A-Za-z]?)\b", sent)
        name_core = mtype.replace("_", " ").title()
        name = f"{name_core} {model.group(1)}".strip() if model else name_core

        cap = _CAPACITY_RE.search(sent)
        capacity = f"{cap.group(1)} {cap.group(2)}" if cap else ""

        price = 0.0
        pm = _PRICE_RE.search(sent)
        if pm:
            price = _num(pm.group(1))
            mult = (pm.group(2) or "").lower()
            if mult in ("k", "thousand"):
                price *= 1_000
            elif mult in ("m", "million"):
                price *= 1_000_000

        energy = 0.0
        em = _ENERGY_RE.search(sent)
        if em:
            energy = _num(em.group(1))

        # confidence grows with how many concrete fields we recovered
        filled = sum(bool(x) for x in (model, capacity, price, energy))
        confidence = round(min(0.35 + filled * 0.15, 0.9), 2)

        key = (name + capacity).lower()
        if key in seen:
            continue
        seen.add(key)

        found.append(
            {
                "name": name[:255],
                "machine_type": mtype,
                "manufacturer": "",
                "country": "",
                "capacity": capacity[:128],
                "estimated_price_usd": price,
                "energy_kw": energy,
                "source_name": source_name,
                "source_url": source_url,
                "excerpt": sent[:500],
                "confidence": confidence,
                "method": "heuristic",
            }
        )
        if len(found) >= 15:
            break
    return found


def extract_machines_ai(text: str, source_name: str, source_url: str) -> list[dict] | None:
    """Optional: use an LLM to extract structured machines. Returns None if the
    LLM is not configured or the call fails (caller falls back to heuristics)."""
    if not settings.LLM_API_KEY:
        return None
    prompt = (
        "Extract powder-coating production or laboratory machines mentioned in the text. "
        "Return ONLY a JSON array; each item: name, machine_type (one of mixer, extruder, "
        "cooling_system, crusher, grinding, sieving, packaging, laboratory, other), manufacturer, "
        "country, capacity, estimated_price_usd (number, 0 if unknown), energy_kw (number, 0 if unknown). "
        "If none, return []. Text:\n\n" + text[:6000]
    )
    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.LLM_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "max_tokens": 1500,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=40,
        )
        resp.raise_for_status()
        content = resp.json()["content"][0]["text"]
        match = re.search(r"\[.*\]", content, re.S)
        records = json.loads(match.group(0) if match else content)
        out = []
        for r in records:
            out.append(
                {
                    "name": str(r.get("name", "Unknown"))[:255],
                    "machine_type": str(r.get("machine_type", "other")),
                    "manufacturer": str(r.get("manufacturer", ""))[:255],
                    "country": str(r.get("country", ""))[:128],
                    "capacity": str(r.get("capacity", ""))[:128],
                    "estimated_price_usd": float(r.get("estimated_price_usd", 0) or 0),
                    "energy_kw": float(r.get("energy_kw", 0) or 0),
                    "source_name": source_name,
                    "source_url": source_url,
                    "excerpt": f"AI-extracted from {source_name}",
                    "confidence": 0.8,
                    "method": "ai",
                }
            )
        return out
    except Exception as exc:  # noqa: BLE001 — any failure -> heuristic fallback
        logger.warning("LLM extraction failed (%s); using heuristics", exc)
        return None


def _is_duplicate(db: Session, rec: dict) -> bool:
    name = rec["name"].lower()
    for m in db.query(Machine).all():
        if m.name.lower() == name or (m.name.lower() in name and len(m.name) > 6):
            return True
    exists = (
        db.query(MachineSuggestion)
        .filter(MachineSuggestion.status == "pending")
        .all()
    )
    return any(s.name.lower() == name for s in exists)


def run_ingestion(db: Session, source_id: int | None = None) -> dict:
    """Scan active sources, extract candidate machines, store new suggestions."""
    query = db.query(IngestionSource).filter(IngestionSource.active.is_(True))
    if source_id is not None:
        query = query.filter(IngestionSource.id == source_id)
    sources = query.all()

    details: list[str] = []
    new_count = 0

    for src in sources:
        try:
            text = _html_to_text(_http_get(src.url))
            records = extract_machines_ai(text, src.name, src.url)
            if records is None:
                records = extract_machines_heuristic(text, src.name, src.url)

            added = 0
            for rec in records:
                if _is_duplicate(db, rec):
                    continue
                db.add(MachineSuggestion(**rec))
                db.flush()
                added += 1
                new_count += 1
            src.last_status = f"{added} new suggestion(s)"
            details.append(f"{src.name}: {added} new")
        except Exception as exc:  # noqa: BLE001
            src.last_status = f"error: {str(exc)[:120]}"
            details.append(f"{src.name}: failed ({str(exc)[:60]})")
            logger.warning("Ingestion failed for %s: %s", src.url, exc)
        src.last_run_at = datetime.now(timezone.utc)

    db.commit()
    return {"sources_scanned": len(sources), "new_suggestions": new_count, "details": details}
