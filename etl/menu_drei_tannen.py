"""Speisekarte des Gasthofs Drei Tannen in Moosburg, Stand 30.08.2026.

Aufbau der Karte: zwei Spalten, Gerichte im Muster `Name _ Preis Marker`,
darunter die Beschreibung mit `|` zwischen den Zutaten. Nummern gibt es nicht,
der Unterstrich vor dem Preis ist der verlaessliche Anker.

Gericht und Beschreibung trennt allein der Unterstrich vor dem Preis. Die
Schriftgroesse taugt dafuer nicht: sie liegt bei den meisten Gerichten bei
14,1 pt, aber `Jaegersauce mit Schwammerl _ 3,90` steht in 14,4 pt, derselben
Groesse wie die Beschreibungen. Nach Groesse sortiert fehlten 61 der 135
Gerichte.

Fuer die Ueberschriften ist die Groesse dagegen brauchbar, in zwei Ebenen:
41,5 pt die Hauptabschnitte (TAGESKARTE, HAUPTGERICHTE, KINDERKARTE), 14,6 pt
die Unterabschnitte (Vorspeise und Suppe, Salate). Dazwischen liegt bei
40,1 pt der Werbetext, der im Layout mit den Hauptueberschriften verschraenkt
ist und ausgelassen wird. Die Toleranz muss eng bleiben: 14,6 minus 0,2 greift bereits in die
Beschreibungen bei 14,4. Weil das kein Sicherheitsabstand ist,
meldet der Pruefbericht die Zahl der nicht zugeordneten Zeilen; springt sie bei
einer neuen Kartenversion, sind die Groessen gewandert.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import (ROOT, Item, portion_header, provenance, report,
                    table_row, write_menu)

PDF = ROOT / "sources/moosburg/drei-tannen_speisekarte_2026-08-30.pdf"
OUT = ROOT / "data/moosburg/menus/drei-tannen_2026-08-30.json"
RETRIEVED = "2026-09-04"
URL = "https://www.gasthof-dreitannen.de/"

DIVIDER = 295.0

# Seitenlayout als waagrechte Baender: ab welcher Hoehe gilt welcher Teiler.
# Die Weinkarte auf Seite 8 ist ganz einspaltig, Name und Beschreibung laufen
# über die volle Breite und damit quer über die Achse; mit Teiler zerfiel
# `Sauvignon blanc Schneider Pfaffmann / Deutschland, Pfalz _ 7,90` in zwei
# Zeilen, und der Wein fehlte.
#
# Seite 9 wechselt auf halber Höhe: die Spirituosen oben stehen zweispaltig,
# ab den Aperitifen läuft die Karte einspaltig weiter. Ein Teiler für die
# ganze Seite zerschnitt dort `Gin Tonic Bombay Sapphire 4cl / Thomas Henry
# 0,2l _ 8,90` und machte aus dem Rest das Gericht `0,2l`.
BANDS: dict[int, list[tuple[float, float | None]]] = {
    8: [(0.0, None)],
    9: [(0.0, DIVIDER), (450.0, None)],
}


def bands(page: int) -> list[tuple[float, float | None]]:
    return BANDS.get(page, [(0.0, DIVIDER)])


# Gemessene Schriftgroessen der beiden Ueberschriftenebenen, mit Toleranz.
HEADINGS = (41.5, 14.6)
TOLERANCE = 0.1

# Ab hier ist eine Zeile Deko, kein Inhalt: der mit den Hauptueberschriften
# verschraenkte Werbetext bei 40,1 pt.
DECORATION_HEIGHT = 20.0

# Die Zeichenerklaerung am Fuss der letzten Seite. Sie steht in derselben
# Groesse wie eine Beschreibung und haengte sich sonst an das zuletzt gelesene
# Getraenk, im Ergebnis trug `Rüscherl` die gesamte Allergenliste als
# Beschreibung. Ab dieser Zeile ist die Seite zu Ende.
FOOTER = re.compile(r"^(Allergene|Zusatzstoffe|Alle Preise)")

# `Name _ Preis` und alles, was hinter dem Preis an Zeichen folgt.
DISH = re.compile(r"^(?P<name>.+?)\s*_\s*(?P<price>\d{1,3},\d{2})\s*(?P<tail>.*)$")

# Die Marker hinter dem Preis: Buchstaben fuer Allergene, Zahlen fuer
# Zusatzstoffe, gemischt und mit Komma getrennt, etwa `A,G,1,5`.
MARKERS = re.compile(r"\b([A-N]|\d{1,2})\b")

# Eine Zeile, deren Name nur eine Menge ist: `0,5l _ 5,60` unter
# `Saft nach Wahl pur 0,3l _ 4,50`. Das ist kein zweites Getraenk, sondern der
# zweite Preis desselben, und stand sonst als Gericht `0,5l` in der Liste.
PORTION_ONLY = re.compile(r"^\d{1,2},\d{1,2}\s*l$", re.I)

SMALL_PORTION = "↡"   # Pfeil fuer "auch als kleine Portion"
CHILLI = "\U0001f336"
DISCOUNT_SMALL_PORTION = 1.50

# Zeichenerklaerung von Seite 9. Hier zaehlen Buchstaben die Allergene und
# Zahlen die Zusatzstoffe, bei Maharaja ist es genau umgekehrt.
LEGEND = {
    "allergens": {
        "A": "gluten", "B": "crustaceans", "C": "eggs", "D": "fish",
        "E": "peanuts", "F": "soybeans", "G": "milk", "H": "nuts",
        "I": "celery", "J": "mustard", "K": "sesame", "L": "sulphites",
        "M": "lupin", "N": "molluscs",
    },
    "additives": {
        "1": "preservative", "2": "flavour_enhancer", "3": "antioxidant",
        "4": "colorant", "5": "phosphate", "6": "sweetener", "7": "caffeine",
        "8": "quinine", "9": "blackened", "10": "phenylalanine",
    },
}

# Die Karte fuehrt einen eigenen Abschnitt dafuer. Vegan steht zusaetzlich am
# einzelnen Gericht, denn nicht alles darin ist vegan: Kaesespaetzle und
# Spiegeleier stehen im selben Abschnitt.
VEGETARIAN_SECTIONS = {"Vegetarisch und vegan"}


def is_heading(row: pdftext.Row) -> bool:
    height = max(w.height for w in row.words)
    return any(abs(height - h) <= TOLERANCE for h in HEADINGS)


def parse() -> dict:
    words = pdftext.words(PDF)
    # Jede Zeile behaelt den Teiler ihres Bandes, denn daran haengt spaeter,
    # in welcher Spalte sie steht.
    rows: list[tuple[pdftext.Row, float | None]] = []
    for page in sorted({w.page for w in words}):
        page_words = [w for w in words if w.page == page]
        limits = bands(page) + [(1e9, None)]
        for (top, divider), (bottom, _) in zip(limits, limits[1:]):
            band = [w for w in page_words if top <= w.y0 < bottom]
            if not band:
                continue
            band_rows = pdftext.rows(band, divider=divider)
            if divider is not None:
                band_rows = pdftext.merge_numeric_tails(band_rows, divider=divider)
            rows += [(r, divider) for r in band_rows]
    sections: list[dict] = []
    last: dict[int, Item | None] = {0: None, 1: None}
    ignored = 0
    heading_top: float | None = None
    # Mengenspalten der laufenden Getraenketabelle, bis zur naechsten
    # Ueberschrift oder Kopfzeile.
    portions: list[str] = []

    page = 0
    for row, divider in rows:
        text = row.text.strip()
        if not text:
            continue
        if row.page != page:
            page, done = row.page, False
        if done:
            continue
        if FOOTER.match(text):
            done = True
            continue
        column = 0 if row.x0 < (divider or 1e9) else 1
        height = max(w.height for w in row.words)

        if is_heading(row):
            # Ueberschriften laufen ueber die volle Breite und zerfallen am
            # Spaltenteiler in zwei Zeilen. Steht die zweite auf derselben
            # Hoehe, gehoert sie an die erste, sonst hiesse der Abschnitt
            # "Feiertagen" statt "Jeden Donnerstag, sowie an Sonn- und
            # Feiertagen".
            if heading_top is not None and abs(row.top - heading_top) < 2:
                sections[-1]["title"] += f" {text}"
            else:
                sections.append({"title": text, "items": []})
                last = {0: None, 1: None}
            heading_top = row.top
            portions = []
            continue

        heading_top = None
        if found := portion_header(text):
            portions = found
        elif m := DISH.match(text):
            if PORTION_ONLY.match(m["name"].strip()) and last[column] is not None:
                last[column].prices.append({
                    "amount": float(m["price"].replace(",", ".")),
                    "currency": "EUR",
                    "portion": m["name"].strip(),
                })
                continue
            item = read_dish(m)
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            sections[-1]["items"].append(item)
            last[column] = item
        elif portions and (item := table_row(text, portions)):
            if not sections:
                sections.append({"title": "Ohne Abschnitt", "items": []})
            sections[-1]["items"].append(item)
            last[column] = item
        elif height < DECORATION_HEIGHT and last[column] is not None:
            item = last[column]
            item.description = f"{item.description} {text}".strip()
        else:
            ignored += 1

    return build(sections), ignored


def read_dish(m: re.Match) -> Item:
    tail = m["tail"]
    amount = float(m["price"].replace(",", "."))
    prices = [{"amount": amount, "currency": "EUR"}]
    if SMALL_PORTION in tail:
        prices.append({
            "amount": round(amount - DISCOUNT_SMALL_PORTION, 2),
            "currency": "EUR",
            "note": "kleine Portion",
        })
    return Item(
        name=m["name"].strip(),
        prices=prices,
        # VEGAN erst entfernen, sonst liest `MARKERS` daraus ein A und ein N.
        markersRaw=MARKERS.findall(tail.replace("VEGAN", "")),
        diet={"vegan": "declared", "vegetarian": "declared"} if "VEGAN" in tail else {},
        # Die Karte kennt nur ein Chilisymbol, keine Abstufung. Stufe 2
        # entspricht dem, was `common.spice` aus dem Wort "scharf" macht.
        spice={"level": 2, "basis": "declared"} if CHILLI in tail else None,
    )


def build(sections: list[dict]) -> dict:
    out = []
    for section in sections:
        if not section["items"]:
            continue
        base = {"vegetarian": "declared"} if section["title"] in VEGETARIAN_SECTIONS else {}
        items = []
        for item in section["items"]:
            diet = dict(base)
            entry = item.to_json(LEGEND, diet)
            items.append(entry)
        out.append({"title": section["title"], "items": items})
    return {
        "restaurantId": "drei-tannen",
        "provenance": provenance(PDF, url=URL, retrieved=RETRIEVED),
        "legend": LEGEND,
        "sections": out,
    }


if __name__ == "__main__":
    menu, ignored = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
    print(f"    nicht zugeordnete Zeilen: {ignored}")
