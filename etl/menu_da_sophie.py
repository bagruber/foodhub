"""Speisekarte von Da Sophie e Massimo im Gasthaus zur Kegelhalle, Moosburg.

Vier Groessen, vier Bedeutungen, sauber getrennt: Ueberschrift 22,5 pt,
Gericht 20,8 pt mit den Markern kleiner daneben, Beschreibung 19,1 pt, und der
Preis allein auf einer Zeile bei 16,5 pt.

Der Preis schreibt sich hier mit Punkt statt Komma, `10.20€`. Das ist keine
Tausendertrennung, sondern die englische Schreibweise, und muss vor dem
Umrechnen ersetzt werden.

Die Karte kennt Zeichen fuer vegan, vegetarisch und drei Schaerfegrade, aber
sie stehen als Grafik in der Seite. Anders als bei der Westerberg-Stub'n sind
es hier neun Seiten mit weit ueber hundert Gerichten; von Hand abzulesen waere
das eine andere Groessenordnung. Sie fehlen deshalb, und das steht in der
Herkunft.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/da-sophie-e-massimo_speisekarte_2026-09-06.pdf"
OUT = ROOT / "data/moosburg/menus/da-sophie-e-massimo_2026-09-06.json"
RETRIEVED = "2026-09-06"
URL = "https://pizza-bestellen-moosburg.de/"

HEADING, DISH, DESCRIPTION, PRICE_SIZE = 22.5, 20.8, 19.1, 16.5
TOLERANCE = 0.4

NUMBERED = re.compile(r"^(?P<ref>\d{1,3})\s+(?P<name>.+)$")
PRICE_ROW = re.compile(r"^(?P<amount>\d{1,3})[.,](?P<cents>\d{2})\s*€$")

LEGEND = {
    "allergens": {
        "A": "gluten", "B": "crustaceans", "C": "eggs", "D": "fish",
        "E": "peanuts", "F": "soybeans", "G": "milk", "H": "nuts",
        "L": "celery", "M": "mustard", "N": "sesame", "O": "sulphites",
        "P": "lupin", "R": "molluscs",
    },
    "additives": {
        "1": "preservative", "2": "antioxidant", "3": "flavour_enhancer",
        "4": "colorant", "5": "sweetener", "6": "phosphate", "7": "caffeine",
        "8": "quinine", "9": "sulphured", "10": "waxed",
    },
}

# Ab hier folgt nur noch das Kleingedruckte der Seite.
END = re.compile(r"^(Zusatzstoffe:|Allergene:|Alle Preise|Impressum)")


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        if not text:
            continue
        if END.match(text):
            last = None
            continue
        height = max(w.height for w in row.words)

        if abs(height - HEADING) <= TOLERANCE:
            sections.append({"title": text.title(), "items": []})
            last = None
            continue
        if abs(height - PRICE_SIZE) <= TOLERANCE and (m := PRICE_ROW.match(text)):
            if last is not None:
                last.prices.append({"amount": float(f"{m['amount']}.{m['cents']}"),
                                    "currency": "EUR"})
            continue

        body, markers = row.split_markers()
        body = body.strip()

        if abs(height - DISH) <= TOLERANCE and (m := NUMBERED.match(body)):
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            last = Item(ref=m["ref"], name=m["name"].strip(), markersRaw=markers)
            sections[-1]["items"].append(last)
        elif abs(height - DESCRIPTION) <= TOLERANCE and last is not None:
            last.description = f"{last.description} {body}".strip()
            last.markersRaw += markers
        else:
            ignored += 1

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "da-sophie-e-massimo-gasthaus-zur-kegelhalle",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Die Zeichen für vegan, vegetarisch und Schärfe stehen als Grafik "
                 "in der Karte und fehlen hier.",
        ),
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
