"""Speisekarte des Restaurants Maharaja in Moosburg, Stand 06.02.2026.

Aufbau der Karte: zwei Spalten, Gerichte durchgehend von 101 bis 412
nummeriert, darunter jeweils eine Beschreibungszeile in kleinerer Schrift.
Abschnittsueberschriften tragen keine Nummer und stehen in der groessten
Schrift der Seite; wo hinter der Ueberschrift noch ein Hinweis steht, ist der
kleiner gesetzt und trennt sich dadurch von selbst ab.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import (PORTION, ROOT, Item, portion_header, prices, provenance,
                    report, write_menu)

PDF = ROOT / "sources/moosburg/maharaja_speisekarte_2026-02-06.pdf"
OUT = ROOT / "data/moosburg/menus/maharaja_2026-02-06.json"
RETRIEVED = "2026-09-04"
URL = "https://maharaja-moosburg.com/"

# Senkrechte Achse zwischen den Spalten, gemessen an der Karte: die linke
# Spalte beginnt bei x=70,8, die rechte bei x=318,7.
DIVIDER = 300.0

# Ab dieser Schrifthoehe gilt eine Zeile ohne Nummer als Ueberschrift.
# Gemessen: Ueberschrift 19,0 pt, Gerichtsname 17,6 pt, Beschreibung 9,9 pt.
HEADING_HEIGHT = 13.0

NUMBER = re.compile(r"^(\d{3})\.\s*")

# Die Zeichenerklaerung steht auf Seite 5 der Karte. Achtung: hier zaehlen
# Ziffern die Allergene und Buchstaben die Zusatzstoffe, bei Drei Tannen ist es
# genau umgekehrt. Ohne diese Tabelle sind die Marker nicht deutbar.
LEGEND = {
    "allergens": {
        "1": "gluten", "2": "milk", "3": "nuts", "4": "peanuts", "5": "fish",
        "6": "molluscs", "7": "crustaceans", "8": "soybeans", "9": "celery",
        "10": "sesame", "11": "lupin", "12": "eggs", "13": "mustard",
        "14": "sulphites",
    },
    "additives": {
        "A": "preservative", "B": "antioxidant", "C": "phosphate",
        "D": "sulphured", "E": "caffeine", "F": "waxed", "G": "colorant",
        "H": "sweetener", "I": "flavour_enhancer", "J": "quinine",
        "K": "blackened", "L": "phenylalanine", "M": "taurine",
    },
}

# Der Abschnitt heisst vollstaendig "Vegetarisch auf Wunsch auch VEGAN
# erhaeltlich". Vegan wird daraus bewusst nicht abgeleitet: die Karte sagt,
# dass die Kueche es vegan zubereiten kann, nicht dass es das ist.
VEGETARIAN_SECTION_PREFIX = "Vegetarisch"


def parse() -> dict:
    rows = pdftext.rows(pdftext.words(PDF), divider=DIVIDER)
    sections: list[dict] = []
    # Beschreibungen gehoeren zum Gericht derselben Spalte, nicht zum zuletzt
    # gelesenen ueberhaupt. Deshalb je Spalte ein eigener Zeiger.
    last: dict[int, Item | None] = {0: None, 1: None}
    # Mengenspalten der laufenden Getraenketabelle, je Spalte. Die Karte
    # kuendigt sie in der Ueberschrift an, `Alkoholfreie Getraenke 0,25l 0,5l`,
    # und die Betraege darunter stehen in derselben Reihenfolge.
    portions: dict[int, list[str]] = {0: [], 1: []}
    # Welcher Abschnitt fuer welche Spalte gilt. Auf den Getraenkeseiten
    # stehen zwei Abschnitte nebeneinander, links "Alkoholfreie Getraenke",
    # rechts "Flaschen". Mit nur einem laufenden Abschnitt ueberschriebe der
    # rechte den linken, und das Leitungswasser stuende unter "Flaschen".
    current: dict[int, int] = {0: -1, 1: -1}
    heading_top: float | None = None

    for row in rows:
        body, markers = row.split_markers()
        body = body.strip()
        if not body:
            continue
        column = 0 if row.x0 < DIVIDER else 1

        if found := portion_header(body):
            portions[column] = found
            continue

        if m := NUMBER.match(body):
            rest = body[m.end():]
            amounts = prices(rest)
            if amounts and len(amounts) == len(portions[column]):
                for amount, portion in zip(amounts, portions[column]):
                    amount["portion"] = portion
            item = Item(
                ref=m[1],
                name=NUMBER.sub("", strip_price(rest)).strip(" .-"),
                prices=amounts,
                markersRaw=markers,
            )
            if current[column] < 0:
                current = {0: len(sections), 1: len(sections)}
                sections.append({"title": "Ohne Abschnitt", "note": None, "items": []})
            sections[current[column]]["items"].append(item)
            last[column] = item
            continue

        height = max(w.height for w in row.words)
        if height >= HEADING_HEIGHT:
            title, note = split_heading(row)
            # Ueber jeder Preisspalte steht ein einzelnes Eurozeichen, gross
            # genug fuer eine Ueberschrift und in einer eigenen Zeile. Ohne
            # diese Pruefung hiesse der Vegetarisch-Abschnitt "€".
            if not any(c.isalpha() for c in title):
                # Die Kinderkarte ist mit Auslassungspunkten ueberschrieben,
                # der Name steht klein daneben. Ein Zusatz aus mehreren
                # Woertern darf einspringen, ein einzelnes nicht: das waere
                # das Ende einer am Spaltenteiler zerschnittenen Zeile.
                if note and len(note.split()) >= 3:
                    title, note = note, None
                else:
                    continue
            index = len(sections)
            sections.append({"title": title, "note": note, "items": []})
            # Die Mengen stehen hier meist in der Ueberschrift selbst,
            # `Alkoholfreie Getraenke 0,25l 0,5l`, nicht in einer eigenen
            # Zeile wie bei Drei Tannen.
            found = [re.sub(r"\s+", "", m)
                     for m in PORTION.findall(f"{title} {note or ''}")]
            if found:
                # Die Mengen stehen nun an den Preisen, im Titel waeren sie
                # doppelt: "Alkoholfreie Getraenke 0,25l 0,5l".
                title = PORTION.sub("", title).strip()
                sections[index]["title"] = title
            # Zwei Ueberschriften auf derselben Hoehe gehoeren zu je einer
            # Spalte. Eine allein stehende gilt fuer beide.
            if heading_top is not None and abs(row.top - heading_top) < 2:
                current[column] = index
                portions[column] = found
            else:
                current = {0: index, 1: index}
                portions = {0: list(found), 1: list(found)}
            heading_top = row.top
            last = {0: None, 1: None}
            continue

        heading_top = None
        if last[column] is not None:
            item = last[column]
            item.description = f"{item.description} {body}".strip()
            item.markersRaw.extend(markers)

    return build(sections)


def strip_price(text: str) -> str:
    """Betraege aus dem Namen entfernen, Mengenangaben wie `0,5l` behalten."""
    return re.sub(r"\b\d{1,3},\d{2}\b(?!\s*l)", " ", text)


def split_heading(row: pdftext.Row) -> tuple[str, str | None]:
    """Ueberschrift und nachgestellter Hinweis trennen sich ueber die Groesse."""
    limit = max(w.height for w in row.words) * 0.8
    big = [w.text for w in row.words if w.height >= limit]
    small = [w.text for w in row.words if w.height < limit]
    return " ".join(big).strip(), (" ".join(small).strip() or None)


def build(sections: list[dict]) -> dict:
    out = []
    for section in sections:
        if not section["items"]:
            continue
        diet = ({"vegetarian": "declared"}
                if section["title"].startswith(VEGETARIAN_SECTION_PREFIX) else None)
        entry = {
            "title": section["title"],
            "items": [i.to_json(LEGEND, diet) for i in section["items"]],
        }
        if section.get("note"):
            entry["note"] = section["note"]
        out.append(entry)
    return {
        "restaurantId": "maharaja",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Das PDF selbst nennt das Haus nirgends. Die Website bietet "
                 "es unter demselben Dateinamen an, unter dem es hier ankam.",
        ),
        "legend": LEGEND,
        "sections": out,
    }


if __name__ == "__main__":
    menu = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
