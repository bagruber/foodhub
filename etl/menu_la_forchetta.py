"""Speisekarte der Pizzeria La Forchetta in Moosburg, Stand 23.09.2025.

Aufbau: zwei Seiten quer, je drei Spalten, Gericht im Muster `Name € Preis`,
darunter die Beschreibung. Die Abschnitte laufen ueber die Spalten weiter, ein
`PASTA` oben in der zweiten Spalte gilt bis zur naechsten Ueberschrift, auch
auf der Folgeseite. Deshalb wird spaltenweise gelesen und der Abschnitt
mitgenommen, nicht zeilenweise ueber die Seite.

Getrennt wird ueber die Schriftgroesse, und hier taugt sie: Ueberschrift
13,7 pt, Gericht 12,6 pt, Beschreibung 11,7 pt, Kleingedrucktes 7,9 pt. Der
Abstand ist gering, aber die Karte ist durchgehend gesetzt, anders als bei den
Drei Tannen.

Ausgelassen bleiben zwei Bloecke: der Kontaktkasten in der dritten Spalte der
ersten Seite, und die Aufpreise fuer Pizzabelag. Belag ist kein Gericht, und
als Eintrag stuende `Speck, Mozzarella, Salsiccia, Gorgonzola, Cocktailtomaten`
mit 3,00 in der Liste.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/la-forchetta_speisekarte_2025-09-23.pdf"
OUT = ROOT / "data/moosburg/menus/la-forchetta_2025-09-23.json"
RETRIEVED = "2026-09-06"
URL = "https://www.la-forchetta.com/"

DIVIDERS = [300.0, 550.0]

# Seite und Spalte des Kontaktkastens: Anschrift, Telefon, Oeffnungszeiten.
# Steht in denselben Groessen wie die Ueberschriften und haette sonst
# `Inhaber Francesco Cataldo` als Abschnitt eroeffnet.
SKIP = {(1, 2)}

HEADING, DISH, DESCRIPTION = 13.7, 12.6, 11.7
TOLERANCE = 0.2

# Kleingedrucktes: die Zeichenerklaerung und die Aufpreise fuer Pizzabelag.
# Letztere tragen einen Preis und kamen deshalb als Gericht durch, mit dem
# Namen `Knoblauch, Olive, Paprika, Peperoni, Kapern, Zwiebeln, Champignons,
# extra Käse` zu 1,00, und standen nach Preis sortiert vor allem Essen.
SMALL = 7.9

PRICE = re.compile(r"^(?P<name>.+?)\s*€\s*(?P<price>\d{1,3},\d{2})\s*$")

# Marker stehen hier nicht hinter dem Preis, sondern mitten im Text hinter der
# Zutat: `Mit Schinken 2,3,4,*,) und Ananas`. Sie klammern anders als auf den
# anderen Karten, `1)2)3)15)` genauso wie `2,3,4,*,)`, deshalb ein eigener
# Ausdruck statt der hochgestellten Marker aus `pdftext`. Die schliessende
# Klammer ist Pflicht, sonst frisst der Ausdruck das `0,` aus `0,75l` und der
# Wein heiszt `Soave Veneto doc, trocken75l`.
MARKER = re.compile(r"(?<=\S)\s*(?:\d{1,2}|\*)[\d*,)]*\)")

LEGEND = {
    "allergens": {
        # Die Karte fuehrt Sulfite unter den Zusatzstoffen. Sie sind aber
        # Allergen L der LMIV, und wer Sulfite meidet, sucht sie dort.
        "14": "sulphites",
    },
    "additives": {
        "1": "colorant", "2": "preservative", "3": "antioxidant",
        "4": "flavour_enhancer", "5": "sulphured",
        # Die Karte druckt `6)-Geschwätz`, gemeint ist geschwaerzt.
        "6": "blackened", "7": "phosphate", "8": "milk_protein",
        "9": "caffeine", "10": "quinine", "11": "sweetener",
        "12": "stabiliser", "15": "acidifier", "*": "formed_meat",
    },
}


def height(row: pdftext.Row) -> float:
    return max(w.height for w in row.words)


def is_size(row: pdftext.Row, size: float) -> bool:
    return abs(height(row) - size) <= TOLERANCE


def column_of(row: pdftext.Row) -> int:
    return sum(1 for b in DIVIDERS if row.x0 >= b)


def strip_markers(text: str) -> tuple[str, list[str]]:
    found: list[str] = []
    for m in MARKER.finditer(text):
        found += re.findall(r"\d{1,2}|\*", m[0])
    return re.sub(r"\s{2,}", " ", MARKER.sub("", text)).strip(" ,."), found


def parse() -> tuple[dict, int]:
    words = pdftext.words(PDF)
    rows = pdftext.rows(words, divider=DIVIDERS)
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    # Spaltenweise, damit ein Abschnitt an seiner Spalte haengt und nicht an
    # der Zeilenhoehe quer ueber die Seite.
    for row in sorted(rows, key=lambda r: (r.page, column_of(r), r.top)):
        if (row.page, column_of(row)) in SKIP:
            continue
        text = row.text.strip()
        if not text:
            continue

        if is_size(row, SMALL):
            continue
        if is_size(row, HEADING) and "€" not in text:
            # `V I N I  B i a n c h i & R o s s i` steht gesperrt gesetzt und
            # kommt als lauter Einzelbuchstaben an.
            title = re.sub(r"\b(\w) (?=\w\b)", r"\1", text)
            sections.append({"title": strip_markers(title)[0], "items": []})
            last = None
        elif m := PRICE.match(text):
            name, markers = strip_markers(m["name"])
            last = Item(
                name=name,
                prices=[{"amount": float(m["price"].replace(",", ".")), "currency": "EUR"}],
                markersRaw=markers,
            )
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            sections[-1]["items"].append(last)
        elif is_size(row, DESCRIPTION) and last is not None:
            body, markers = strip_markers(text)
            last.description = f"{last.description} {body}".strip()
            last.markersRaw += markers
        else:
            ignored += 1

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "la-forchetta",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Aufpreise für Pizzabelag nicht übernommen",
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
