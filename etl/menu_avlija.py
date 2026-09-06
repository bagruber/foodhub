"""Speisekarte des Balkan-Restaurants Avlija, Karte vom 24.01.2024.

Nicht von der Seite des Hauses, sondern von speisekarte.de. Das steht in der
Herkunft, denn es ist ein Unterschied: der Wirt hat diese Fassung nicht
veroeffentlicht, ein Portal hat sie erfasst. Die Fusszeile des PDF nennt beide
Daten, das der Karte und das des Abrufs, und sie widersprechen sich um zwei
Jahre. Gerechnet wird mit dem Kartendatum.

Der Aufbau ist der regelmaessigste im ganzen Bestand: Name, Beschreibung,
Preis, jeweils in einer eigenen Zeile und mittig gesetzt, unterschieden allein
durch die Schriftgroesse. Ueberschrift 22,5 pt, Name und Preis 18,4 pt,
Beschreibung 16,4 pt. Kopf und Fuss der Seite haben eigene Groessen und fallen
darueber heraus.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/balkan-restaurant-avlija_speisekarte_2024-01-24.pdf"
OUT = ROOT / "data/moosburg/menus/balkan-restaurant-avlija_2024-01-24.json"
RETRIEVED = "2026-09-06"
# Die Seite, auf der die Karte liegt. Nicht die des Hauses: das ist der Punkt.
URL = ("https://www.speisekarte.de/moosburg-an-der-isar/restaurant/"
       "balkan_restaurant_avlija/speisekarte")
# Aus der Fusszeile des PDF, nicht aus den Metadaten: die sagen, wann der
# Ausdruck entstand, nicht wann die Karte galt.
CREATED = "2024-01-24"

HEADING, DISH, DESCRIPTION = 22.5, 18.4, 16.4
TOLERANCE = 0.4

# Kopf (Hausname 24,6 pt, Anschrift 14,3 pt) und Fuss (12,3 pt) stehen auf
# jeder der sieben Seiten und sind kein Inhalt.
CHROME = (24.6, 14.3, 12.3)

# Eine reine Preiszeile. Mehrere Betraege stehen mit Strich getrennt, wenn es
# das Gericht in zwei Groessen gibt: `20,00 € | 60,00 €` unter Teigschnecken,
# deren Beschreibung `Ø 20/50 cm` nennt.
PRICE_ROW = re.compile(r"^\d{1,3},\d{2}\s*€(?:\s*[|/]\s*\d{1,3},\d{2}\s*€)*$")
AMOUNT = re.compile(r"(\d{1,3}),(\d{2})")


def size(row: pdftext.Row) -> float:
    return max(w.height for w in row.words)


def near(value: float, target: float) -> bool:
    return abs(value - target) <= TOLERANCE


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        height = size(row)
        if not text or any(near(height, c) for c in CHROME):
            continue

        if near(height, HEADING):
            sections.append({"title": text, "items": []})
            last = None
        elif near(height, DESCRIPTION) and last is not None:
            last.description = f"{last.description} {text}".strip()
        elif near(height, DISH) and PRICE_ROW.match(text) and last is not None:
            last.prices += [{"amount": float(f"{m[1]}.{m[2]}"), "currency": "EUR"}
                            for m in AMOUNT.finditer(text)]
        elif near(height, DISH):
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            last = Item(name=text)
            sections[-1]["items"].append(last)
        else:
            ignored += 1

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    prov = provenance(PDF, url=URL, retrieved=RETRIEVED,
                      note="Über speisekarte.de erfasst, nicht von der Seite des Hauses. "
                           "Die Karte selbst ist vom 24.01.2024.")
    # `pdf_created` liest das Datum des Ausdrucks. Gemeint ist das der Karte.
    prov["createdAt"] = CREATED
    return {
        "restaurantId": "balkan-restaurant-avlija",
        "provenance": prov,
        "legend": {"allergens": {}, "additives": {}},
        "sections": [
            {"title": s["title"], "items": [i.to_json({"allergens": {}, "additives": {}})
                                            for i in s["items"]]}
            for s in sections if s["items"]
        ],
    }


if __name__ == "__main__":
    menu, ignored = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
    print(f"    nicht zugeordnete Zeilen: {ignored}")
