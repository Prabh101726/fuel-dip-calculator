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

import pdfplumber

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


def parse_pdf(pdf_path: str, warnings: list[str]) -> dict[str, TankRecord]:
    tanks: dict[str, TankRecord] = {}
    last_chart_number: str | None = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            words = page.extract_words()
            if not words:
                continue
            lines = group_words_into_lines(words)
            header_lines, data_lines = split_header_and_data(lines)
            header = parse_header(header_lines)
            if header is None:
                raw = " ".join(w["text"] for line in header_lines[:2] for w in line)
                warnings.append(f"page {page_num}: no 'TANK TYPE #...' header found, skipping. First words: {raw!r}")
                continue

            anomaly = detect_anomalous_layout(header, data_lines)
            if anomaly:
                warnings.append(f"page {page_num}: skipping tank #{header['chart_number']}: {anomaly}")
                continue

            if header["capacity_liters"] is None:
                warnings.append(f"page {page_num}: tank #{header['chart_number']} has no parseable CAPACITY, skipping")
                continue

            points = parse_data_rows(data_lines, page_num, warnings)
            chart_number = header["chart_number"]

            if chart_number in tanks:
                if header["part_num"] != 1 and chart_number != last_chart_number:
                    warnings.append(
                        f"page {page_num}: continuation page for #{chart_number} part {header['part_num']} "
                        f"doesn't immediately follow that tank's previous page, appending anyway"
                    )
                elif header["part_num"] == 1:
                    warnings.append(f"page {page_num}: duplicate chart_number #{chart_number}, merging into existing tank")
                tanks[chart_number].points.extend(points)
                tanks[chart_number].pages.append(page_num)
            else:
                tanks[chart_number] = TankRecord(
                    chart_number=chart_number,
                    manufacturer=header["manufacturer"],
                    capacity_liters=header["capacity_liters"],
                    points=points,
                    pages=[page_num],
                )

            last_chart_number = chart_number
    return tanks


def validate_tanks(tanks: dict[str, TankRecord], warnings: list[str]) -> tuple[dict[str, TankRecord], dict[str, str]]:
    good: dict[str, TankRecord] = {}
    flagged: dict[str, str] = {}
    for chart_number, tank in tanks.items():
        if not tank.points:
            flagged[chart_number] = "no dip/volume points parsed"
            continue
        if tank.capacity_liters <= 0:
            flagged[chart_number] = f"non-positive capacity {tank.capacity_liters}"
            continue
        max_volume = max(v for _, v in tank.points)
        relative_diff = abs(max_volume - tank.capacity_liters) / tank.capacity_liters
        if relative_diff > CAPACITY_TOLERANCE:
            flagged[chart_number] = (
                f"max charted volume {max_volume} is {relative_diff:.1%} off stated capacity {tank.capacity_liters}"
            )
            continue
        good[chart_number] = tank
    return good, flagged


def write_outputs(good: dict[str, TankRecord], flagged: dict[str, str], warnings: list[str], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    good_json = {
        chart_number: {
            "manufacturer": tank.manufacturer,
            "capacity_liters": tank.capacity_liters,
            "points": tank.points,
            "pages": tank.pages,
        }
        for chart_number, tank in good.items()
    }
    (out_dir / "dip_charts.json").write_text(json.dumps(good_json, indent=2))
    (out_dir / "review_needed.json").write_text(json.dumps(flagged, indent=2))
    (out_dir / "parse_warnings.log").write_text("\n".join(warnings))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf_path")
    parser.add_argument("out_dir")
    args = parser.parse_args()

    warnings: list[str] = []
    tanks = parse_pdf(args.pdf_path, warnings)
    good, flagged = validate_tanks(tanks, warnings)
    write_outputs(good, flagged, warnings, Path(args.out_dir))

    print(f"Parsed {len(tanks)} tanks: {len(good)} good, {len(flagged)} flagged for review.")
    print(f"{len(warnings)} row/page-level warnings logged.")
    print(f"Output written to {args.out_dir}/")


if __name__ == "__main__":
    main()
