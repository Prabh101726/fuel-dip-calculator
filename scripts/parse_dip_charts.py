"""One-time ETL: parse the FLT dip-chart PDF into tank_types + dip_chart_points
data. Not part of the app runtime.

Run: python3 scripts/parse_dip_charts.py <pdf_path> <out_dir>
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

NUMERIC_TOKEN_RE = re.compile(r"^[\d,]+(\.\d+)?$")
HEADER_RE = re.compile(r"TANK TYPE #(\S+?)(?:\s+(\d+)\s+OF\s+(\d+))?(?:\s|$)")
CAPACITY_RE = re.compile(r"CAPACITY\s+([\d,]+(?:\.\d+)?)")
ANOMALY_MARKERS = ("VOLUME @", "ROOM")
CAPACITY_TOLERANCE = 0.03  # max charted volume must be within 3% of stated capacity
Y_TOLERANCE = 2.0  # points within this many pt of each other are the same visual line


@dataclass
class TankRecord:
    chart_number: str
    manufacturer: str
    capacity_liters: float
    points: list[tuple[float, float]] = field(default_factory=list)
    pages: list[int] = field(default_factory=list)


def clean_number(token: str) -> float | None:
    """Parse a raw PDF token like '38,209' or '49449.13' into a float.
    Returns None for malformed tokens (e.g. the '38/117' artifact on page 325)."""
    if not NUMERIC_TOKEN_RE.match(token):
        return None
    return float(token.replace(",", ""))


def group_words_into_lines(words: list[dict]) -> list[list[dict]]:
    """Cluster words by y-coordinate ('top') into visual lines, each sorted
    left-to-right by x0. Coordinate-aware, per the design spec, rather than
    trusting pdfplumber's own text-line reconstruction on multi-column pages."""
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines: list[list[dict]] = []
    for w in sorted_words:
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= Y_TOLERANCE:
            lines[-1].append(w)
        else:
            lines.append([w])
    for line in lines:
        line.sort(key=lambda w: w["x0"])
    return lines


def split_header_and_data(lines: list[list[dict]]) -> tuple[list[list[dict]], list[list[dict]]]:
    """A data line has >= 2 words and every word is a numeric token. Everything
    before the first data line is header."""
    for i, line in enumerate(lines):
        texts = [w["text"] for w in line]
        if len(texts) >= 2 and all(NUMERIC_TOKEN_RE.match(t) for t in texts):
            return lines[:i], lines[i:]
    return lines, []


def parse_header(header_lines: list[list[dict]]) -> dict | None:
    """Returns None if no 'TANK TYPE #...' header is found (e.g. a
    cross-reference index page, or a differently-formatted page like
    'DESERT OIL MANIWAKI TANK #226') — those are logged and skipped by the
    caller, never guessed at."""
    text = " ".join(w["text"] for line in header_lines for w in line)
    match = HEADER_RE.search(text)
    if not match:
        return None
    chart_number, part_num, _part_total = match.groups()
    cap_match = CAPACITY_RE.search(text)
    capacity = clean_number(cap_match.group(1)) if cap_match else None
    manufacturer = (text[: match.start()] + " " + text[match.end() :]).strip()
    manufacturer = CAPACITY_RE.sub("", manufacturer).strip(" -")
    return {
        "chart_number": chart_number,
        "part_num": int(part_num) if part_num else 1,
        "capacity_liters": capacity,
        "manufacturer": manufacturer or chart_number,
        "raw_header": text,
    }


def detect_anomalous_layout(header: dict, data_lines: list[list[dict]]) -> str | None:
    """Returns a skip reason if this tank's table doesn't match the standard
    2-values-per-column-group (dip, volume) layout. Two known cases in this
    document: a 'DIP VOLUME @ 95%' triple-column layout, and pages where most
    rows have an odd token count and can't be safely paired without risking
    silently mismatched dip/volume numbers."""
    if any(marker in header["raw_header"] for marker in ANOMALY_MARKERS):
        return f"header contains anomaly marker (one of {ANOMALY_MARKERS}); likely a non-standard column layout"
    if not data_lines:
        return "no data rows found"
    odd_lines = sum(1 for line in data_lines if len(line) % 2 != 0)
    if odd_lines / len(data_lines) > 0.5:
        return f"{odd_lines}/{len(data_lines)} data rows have an odd token count; layout doesn't match dip/volume pairs"
    return None


def parse_data_rows(data_lines: list[list[dict]], page_num: int, warnings: list[str]) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for line in data_lines:
        tokens = [w["text"] for w in line]
        if len(tokens) % 2 != 0:
            warnings.append(f"page {page_num}: dropping trailing unpaired token {tokens[-1]!r}")
            tokens = tokens[:-1]
        for i in range(0, len(tokens), 2):
            dip = clean_number(tokens[i])
            vol = clean_number(tokens[i + 1])
            if dip is None or vol is None:
                warnings.append(f"page {page_num}: dropping unparseable pair {tokens[i]!r}/{tokens[i + 1]!r}")
                continue
            points.append((dip, vol))
    return points
