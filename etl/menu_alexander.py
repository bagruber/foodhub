"""Speisekarte von Alexander The Great in Moosburg.

Einspaltig und durchnummeriert. Der Name steht links am Rand mit seiner Nummer,
die Beschreibung eingerueckt darunter, und am Ende ihrer letzten Zeile
rechtsbuendig der Preis. Getrennt wird deshalb an der Spalte, nicht an der
Schriftgroesse: Name und Beschreibung sind beide 17,7 pt.

Die Zeichenerklaerung auf der letzten Seite ist eine der eigenwilligeren im
Bestand. `A` bis `N` sind die Allergene, aber nicht in der Reihenfolge der
LMIV: `G` sind Schalenfruechte, `N` ist Fisch. Und sie fuehrt zweimal
dasselbe: `5) mit Schwefeldioxid und Sulfiten` neben `K) enthält SO2 und
Sulfit`, `16) mit Gluten` neben `A) enthält glutenhaltiges Getreide`. Beide
Schreibweisen zeigen auf dasselbe Allergen.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/alexander-the-great_speisekarte_2026-09-06.pdf"
OUT = ROOT / "data/moosburg/menus/alexander-the-great_2026-09-06.json"
RETRIEVED = "2026-09-06"
URL = "https://www.alexander-the-great.de/"

HEADING = 22.1
TOLERANCE = 0.4

# Der Name beginnt am linken Rand bei 70,8, die Beschreibung eingerueckt bei
# 116,2. Dazwischen liegt die Grenze.
INDENT = 100.0

NUMBERED = re.compile(r"^(?P<ref>\d{1,3})\.\s*(?P<name>.*)$")
PRICE = re.compile(r"\s*(\d{1,3}),(\d{2})\s*€\s*$")

# Marker stehen hochgestellt hinter der Zutat, mit Komma getrennt: `1, 2, N`.
# Sie kommen als eigene, kleinere Woerter und werden deshalb ueber die
# Geometrie getrennt, nicht ueber einen Ausdruck auf dem Text.
LEGEND = {
    "allergens": {
        "A": "gluten", "B": "crustaceans", "C": "eggs", "D": "peanuts",
        "E": "soybeans", "F": "milk", "G": "nuts", "H": "celery",
        "I": "mustard", "J": "sesame", "K": "sulphites", "L": "lupin",
        "M": "molluscs", "N": "fish",
        # Die Karte fuehrt diese beiden unter den Zusatzstoffen, gemeint sind
        # Allergene, und dort sucht sie auch jemand.
        "5": "sulphites", "16": "gluten",
    },
    "additives": {
        "1": "colorant", "2": "preservative", "3": "antioxidant",
        "4": "flavour_enhancer", "6": "blackened", "7": "phosphate",
        "8": "milk_protein", "9": "caffeine", "10": "quinine",
        "11": "sweetener", "12": "phenylalanine", "13": "waxed",
        "14": "taurine", "15": "flavouring",
    },
}


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        if not text:
            continue
        height = max(w.height for w in row.words)

        if abs(height - HEADING) <= TOLERANCE:
            sections.append({"title": text, "items": []})
            last = None
            continue

        body, markers = row.split_markers()
        body = body.strip()

        if row.x0 < INDENT and (m := NUMBERED.match(body)):
            # Nummer 6 steht ohne Namen auf der Karte, ein Rest einer
            # frueheren Fassung. Ein Gericht ohne Namen ist keines.
            if not m["name"].strip():
                continue
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            # Die Beilagen brauchen keine Beschreibung und tragen den Preis
            # deshalb gleich in der Namenszeile.
            name, prices = m["name"].strip(), []
            if price := PRICE.search(name):
                prices = [{"amount": float(f"{price[1]}.{price[2]}"), "currency": "EUR"}]
                name = name[:price.start()].rstrip()
            last = Item(ref=m["ref"], name=name, prices=prices, markersRaw=markers)
            sections[-1]["items"].append(last)
            continue

        if last is None:
            ignored += 1
            continue

        if price := PRICE.search(body):
            last.prices.append({"amount": float(f"{price[1]}.{price[2]}"), "currency": "EUR"})
            body = body[:price.start()].rstrip()
        last.markersRaw += markers
        if body:
            last.description = f"{last.description} {body}".strip()

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "alexander-the-great",
        "provenance": provenance(PDF, url=URL, retrieved=RETRIEVED),
        "legend": LEGEND,
        "sections": [
            {"title": s["title"], "items": [i.to_json(LEGEND) for i in s["items"]]}
            for s in sections if s["items"]
        ],
    }


if __name__ == "__main__":
    menu, ignored = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
    print(f"    nicht zugeordnete Zeilen: {ignored}")
