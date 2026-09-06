"""Speisekarte der Westerberg-Stub'n in Moosburg, Stand 29.07.2026.

Der Textteil ist einfach: eine Spalte, Gericht als `Name Preis€` mit
rechtsbuendigem Preis, darunter die Beschreibung. Bündig gesetzte Notizen
beginnen mit Auslassungspunkten und sind kein Gericht.

Zwei Dinge stehen aber nicht im Text, sondern als Grafik in der Seite:

*   die Abschnittsueberschriften, handschriftlich gesetzt (`Salate`, `Burger`,
    `Hauptgerichte`).
*   das gruene Blatt hinter dem Namen, das vegetarische Gerichte auszeichnet.

Beides ist deshalb hier von Hand eingetragen, abgelesen von den gerenderten
Seiten. Das ist die Stelle, die bei einer neuen Kartenversion zuerst falsch
wird, und der einzige Ort im Bestand mit von Hand gepflegten Inhalten.
`check.py` prueft darum, dass jeder vegetarisch gesetzte Name auch wirklich
auf der Karte steht: verschwindet ein Gericht, faellt es auf.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/westerberg-stubn_speisekarte_2026-07-29.pdf"
OUT = ROOT / "data/moosburg/menus/westerberg-stubn_speisen_2026-07-29.json"
RETRIEVED = "2026-09-06"
URL = "https://www.westerberg-stubn.de/"

# Ab welcher Hoehe welcher Abschnitt gilt, Seite fuer Seite. Von den
# gerenderten Seiten abgelesen, siehe Modulkopf.
SECTIONS: dict[int, list[tuple[float, str]]] = {
    1: [(0, "Salate"), (380, "Suppen"), (460, "Für unsere kleinen Gäste")],
    2: [(0, "Burger"), (600, "Sonn- und Feiertage")],
    3: [(0, "Getränk des Monats"), (300, "Suppen"), (420, "Hauptgerichte")],
    4: [(0, "Hauptgerichte"), (620, "Desserts und Eis")],
}

# Die Gerichte mit gruenem Blatt. Der Wortlaut muss dem Namen auf der Karte
# entsprechen, sonst meldet `check.py`.
VEGETARIAN = {
    "Kleiner Beilagensalat",
    "Großer Beilagensalat",
    "Pommes mit Ketchup",
    "Veggie-Burger",
    "Fruchtige Tomatensuppe mit Sahnehaube und Croutons",
    "Hausgemachte Spinatknödel",
    "Frische Pfifferlinge",
    "„Green-Power-Bowl“ vegan",
}
VEGAN = {"„Green-Power-Bowl“ vegan"}

DISH = re.compile(r"^(?P<name>.+?)\s*(?P<price>\d{1,3},\d{2})\s*€$")

# Zusaetze und Hinweise beginnen mit Auslassungspunkten: `…dazu wahlweise
# Pommes frites`, `…alle anderen Gerichte gibt es auch als Kinderportion`.
# Sie gelten fuer den ganzen Abschnitt, nicht fuer das Gericht darueber, und
# duerfen deshalb nicht als Beschreibung angehaengt werden.
NOTE = re.compile(r"^[…\.]{1,4}")

# Fusszeile und Zeichenerklaerung.
CHROME = re.compile(r"^(= vegetarisch|Am Stadion|Für Umbestellungen)")


def section_at(page: int, top: float) -> str:
    bands = SECTIONS[page]
    return [title for start, title in bands if top >= start][-1]


def parse() -> tuple[dict, int]:
    words = pdftext.words(PDF)
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    for row in pdftext.rows(words):
        text = row.text.strip()
        if not text or CHROME.match(text):
            continue
        title = section_at(row.page, row.top)
        if not sections or sections[-1]["title"] != title:
            sections.append({"title": title, "items": []})
            last = None

        if NOTE.match(text):
            # Beendet auch die laufende Beschreibung, sonst haengt sich die
            # zweite Zeile des Hinweises an das Gericht darueber.
            last = None
        elif m := DISH.match(text):
            last = Item(
                name=m["name"].strip(),
                prices=[{"amount": float(m["price"].replace(",", ".")), "currency": "EUR"}],
            )
            sections[-1]["items"].append(last)
        elif not sections[-1]["items"]:
            # Jeder Abschnitt beginnt mit einem Gericht. Der Sonntagsbraten
            # ist das einzige ohne Preis, weil er nur angekuendigt wird.
            last = Item(name=text)
            sections[-1]["items"].append(last)
        elif last is not None:
            last.description = f"{last.description} {text}".strip()
        else:
            ignored += 1

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    out = []
    for section in sections:
        items = []
        for item in section["items"]:
            diet = {}
            if item.name in VEGETARIAN:
                diet["vegetarian"] = "declared"
            if item.name in VEGAN:
                diet["vegan"] = "declared"
            items.append(item.to_json({"allergens": {}, "additives": {}}, diet))
        if items:
            out.append({"title": section["title"], "items": items})
    return {
        "restaurantId": "westerberg-stubn",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Abschnitte und Vegetarisch-Kennzeichnung stehen als Grafik in der Karte "
                 "und sind von Hand übertragen",
        ),
        "legend": {"allergens": {}, "additives": {}},
        "sections": out,
    }


if __name__ == "__main__":
    menu, ignored = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
    print(f"    nicht zugeordnete Zeilen: {ignored}")
