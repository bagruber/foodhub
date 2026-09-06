"""Speisekarte von Mythos im Moosburger Hof in Moosburg.

Der regelmaessigste Aufbau nach Avlija: `Nummer Name € Preis` in einer Zeile,
die Beschreibung eingerueckt darunter, Abschnittsueberschriften deutlich
groesser. Alles laesst sich an der Schriftgroesse trennen, 13,6 pt fuer das
Gericht, 10,9 pt fuer die Beschreibung, 23,1 pt fuer die Ueberschrift.

Die Karte weist keine Allergene aus, deshalb ist die Zeichenerklaerung leer.
Die vereinzelten Zeichen bei 12,8 pt sind Aufzaehlungspunkte aus einer
Symbolschrift und kommen als Zeichen aus dem privaten Unicode-Bereich an.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/mythos-im-moosburger-hof_speisekarte_2026-09-06.pdf"
OUT = ROOT / "data/moosburg/menus/mythos-im-moosburger-hof_2026-09-06.json"
RETRIEVED = "2026-09-06"
URL = "https://www.mythos-moosburg.de/"

HEADING, DISH, DESCRIPTION = 23.1, 13.6, 10.9
TOLERANCE = 0.4

DISH_ROW = re.compile(r"^(?P<ref>\d{1,3})\s+(?P<name>.+?)\s*€\s*(?P<price>\d{1,3},\d{2})$")

# Zeichen aus dem privaten Unicode-Bereich: Aufzaehlungspunkte einer
# Symbolschrift, die als Text im PDF stehen und nichts bedeuten.
PRIVATE = re.compile(r"[-]")

LEGEND: dict[str, dict[str, str]] = {"allergens": {}, "additives": {}}


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    for row in pdftext.rows(pdftext.words(PDF)):
        text = PRIVATE.sub("", row.text).strip()
        if not text:
            continue
        height = max(w.height for w in row.words)

        if abs(height - HEADING) <= TOLERANCE:
            sections.append({"title": text, "items": []})
            last = None
        elif abs(height - DISH) <= TOLERANCE and (m := DISH_ROW.match(text)):
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            last = Item(
                ref=m["ref"],
                name=m["name"].strip(),
                prices=[{"amount": float(m["price"].replace(",", ".")), "currency": "EUR"}],
            )
            sections[-1]["items"].append(last)
        elif abs(height - DESCRIPTION) <= TOLERANCE and last is not None:
            last.description = f"{last.description} {text}".strip()
        else:
            ignored += 1

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "mythos-im-moosburger-hof",
        "provenance": provenance(PDF, url=URL, retrieved=RETRIEVED,
                                 note="Die Karte weist keine Allergene aus."),
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
