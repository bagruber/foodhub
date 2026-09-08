"""ToGo- und Lieferkarte von The Corner House in Moosburg.

Nicht die Karte im Haus, sondern die zum Mitnehmen und Liefern. Das steht in
der Herkunft, denn es ist ein Unterschied: was hier nicht steht, gibt es
womoeglich trotzdem, nur nicht ausser Haus.

Aus Canva, acht Seiten, mit Textlayer. Der Aufbau ist einfach — Name und
Preis in einer Zeile bei 28 pt, Beschreibung darunter bei 21 pt — aber
`pdftotext -layout` liefert ihn falsch: es sortiert die Preisspalte in einen
eigenen Block und schiebt sie dabei um zwei Zeilen. Auf der Dip-Seite bekaeme
die Guacamole so den Preis der Aioli. Ueber die Wortpositionen stimmt es,
Preis und Name teilen sich die Mitte der Zeile auf ein Hundertstel genau.
Deshalb wird hier nichts anhand des Fliesstextes geprueft.

Drei Stellen wechseln das Thema, ohne dass die Karte eine Ueberschrift
druckt: die Burger auf Seite 3, die Salate auf Seite 7 und die Crisps
dahinter. Sie stehen in `STARTS`, angehaengt an das erste Gericht darunter.
Geraten ist daran nichts — auf Seite 3 endet jedes Gericht auf „Burger", vor
den Salaten steht der Hinweis zum Dressing.

Die Wochenspecials tragen den Tag, an dem es sie gibt, in einer eigenen
kleineren Zeile: `Jeden Mittwoch:`. Der Tag haengt am Abschnittstitel, denn
ohne ihn stuende ein Gericht in der Liste, das es an fuenf von sieben Tagen
nicht gibt.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/the-corner-house_togo-und-lieferkarte_2026-08-19.pdf"
OUT = ROOT / "data/moosburg/menus/the-corner-house_togo_2026-08-19.json"
RETRIEVED = "2026-09-09"
URL = "https://thecornerhouse-moosburg.de/"

# Ab hier ist eine Zeile Gericht oder Ueberschrift, darunter Beschreibung.
DISH = 28.0

# `€ 13,40`, `€13,40` und einmal `€ 13.40` mit Punkt statt Komma.
PRICE = re.compile(r"€\s*(?P<amount>\d{1,3})[,.](?P<cents>\d{2})\s*$")

# Kopf und Fuss stehen auf jeder Seite und sind kein Inhalt.
CHROME = re.compile(r"^(ToGo und Lieferkarte$|Landshuter Str\.|thecornerhouse\.de)")

# Abschnitte, die die Karte nicht ueberschreibt. Schluessel ist das erste
# Gericht darunter.
STARTS = {
    "Galway Burger": "Burger",
    "Kleiner gemischter Salat": "Salate",
    # Die Crisps stehen hinter den Salaten und sind keine. Die Karte fuehrt
    # einen eigenen Sammelabschnitt, und dorthin gehoeren sie.
    "Crisps": "Other Stuff",
}

# Aufpreise auf ein Gericht, keine eigenen Gerichte. Wie bei La Forchetta und
# im Staudinger Keller bleiben sie draussen.
SURCHARGE = "Options"

# `Jeden Mittwoch:` — kleiner gesetzt als eine Ueberschrift, aber eine.
# Laenge als Sicherung: eine Beschreibung, die auf einen Doppelpunkt endet,
# soll keinen Abschnitt aufmachen.
SUBHEAD = 70

LEGEND: dict[str, dict[str, str]] = {"allergens": {}, "additives": {}}


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0
    head = sub = ""
    note: str | None = None
    skip = False

    def open_section() -> dict:
        title = f"{head} · {sub}" if sub else head
        for section in sections:
            if section["title"] == title:
                return section
        sections.append({"title": title or "Ohne Abschnitt", "note": note, "items": []})
        return sections[-1]

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        if not text or CHROME.match(text):
            continue
        big = max(w.height for w in row.words) >= DISH - 0.5
        price = PRICE.search(text)

        if big and not price:
            # Eine grosse Zeile ohne Preis ueberschreibt, was folgt.
            head, sub, note, last = text.rstrip(": ").strip(), "", None, None
            skip = head == SURCHARGE
            continue
        if skip:
            continue
        if not big:
            if text.endswith(":") and len(text) <= SUBHEAD:
                sub, last = text.rstrip(": ").strip(), None
                continue
            if last is not None:
                last.description = f"{last.description} {text}".strip()
            else:
                # Ein Hinweis vor dem ersten Gericht gilt dem Abschnitt: die
                # Herkunft des Rinds, die Wahl des Dressings.
                note = f"{note} {text}".strip() if note else text
            continue

        if start := STARTS.get(text[:price.start()].strip()):
            head, sub, note, last = start, "", None, None
        last = Item(
            name=text[:price.start()].strip(),
            prices=[{"amount": float(f"{price['amount']}.{price['cents']}"), "currency": "EUR"}],
            diet=diet_of(text),
        )
        open_section()["items"].append(last)

    return build(sections), ignored


def diet_of(name: str) -> dict:
    """Nur, was die Karte hinschreibt. `(vegan)` steht im Namen."""
    return {"vegan": "declared", "vegetarian": "declared"} if "(vegan)" in name.lower() else {}


def build(sections: list[dict]) -> dict:
    out = []
    for s in sections:
        if not s["items"]:
            continue
        entry: dict = {"title": s["title"]}
        if s["note"]:
            entry["note"] = s["note"]
        entry["items"] = [i.to_json(LEGEND) for i in s["items"]]
        out.append(entry)
    return {
        "restaurantId": "the-corner-house",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Karte zum Mitnehmen und Liefern, nicht die Karte im Haus. "
                 "Allergene weist sie nicht aus. Die Aufpreise unter „Options“ "
                 "sind nicht erfasst.",
        ),
        "legend": LEGEND,
        "sections": out,
    }


if __name__ == "__main__":
    menu, ignored = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
    print(f"    nicht zugeordnete Zeilen: {ignored}")
