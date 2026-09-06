"""Getraenkekarte der Westerberg-Stub'n in Moosburg, Stand 27.06.2026.

Die Karte hat zwei Layouts, und der Parser hat deshalb zwei Betriebsarten.

Auf den Getraenkeseiten steht je Zeile ein Getraenk, `Name [Menge] Preis€` mit
rechtsbuendigem Preis, darunter die Zutaten. Steht darueber eine Kopfzeile wie
`0,25l 0,5l`, hat die Zeile zwei Preise.

Auf den Weinseiten ist die rechte Spalte dagegen eine Preistabelle, die sich
ueber die ganze Beschreibung erstreckt:

    Grauer Burgunder - trocken                        0,1l   3,90€
    Weingut Schittler Becker, Rheinhessen             0,2l   6,90€
    Fruchtig und cremig mit Aromen von Birne,        0,75l  21,90€
    Honigmelone und Mandel

Jede Zeile traegt also einen Preis, aber nur die erste den Namen. Getrennt
werden die Weine am senkrechten Abstand: innerhalb eines Weins liegen die
Zeilen 17 pt auseinander, zwischen zwei Weinen mindestens 34.

Wie bei der Speisekarte stehen die grossen Ueberschriften als Grafik in der
Seite und sind hier von Hand eingetragen. Bei den Weinen nicht: `Weiszwein`,
`Rosè` und `Rotwein` sind gesetzter Text.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, portion_header, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/westerberg-stubn_getraenkekarte_2026-06-27.pdf"
OUT = ROOT / "data/moosburg/menus/westerberg-stubn_getraenke_2026-06-27.json"
RETRIEVED = "2026-09-06"
URL = "https://www.westerberg-stubn.de/"

# Seite 1 und 2 sind Begruessung und Feiernwerbung, Seite 9 Lieferantenliste
# und Zeichenerklaerung.
SKIP_PAGES = {1, 2, 9}
WINE_PAGES = {7, 8}

# Von den gerenderten Seiten abgelesene Ueberschriften, siehe Modulkopf.
GRAPHIC: dict[int, list[tuple[float, str]]] = {
    3: [(0, "Aperitifs"), (400, "Alkoholfreie Getränke")],
    4: [(0, "Säfte und Fruchtschorlen"), (300, "Biere")],
    5: [(0, "Digestif")],
    6: [(0, "Digestif"), (400, "Warme Getränke")],
    8: [(550, "Weinschorlen")],
}

# Ueberschrift der Weinseiten, gesetzt und deutlich groesser als der Rest.
HEADING_HEIGHT = 19.5

# `4,20€`, aber auch `7,- €`. Davor darf eine Menge stehen.
TAIL = re.compile(
    r"\s*(?:(?P<portion>\d{1,2},\d{1,2}\s*l)\s+)?(?P<price>\d{1,3},(?:\d{2}|-))\s*€\s*$"
)

# Zusatzstoffe stehen geklammert hinter dem Namen: `Coca-Cola (1,9,11)`.
MARKER = re.compile(r"\s*\((\d{1,2}(?:\s*,\s*\d{1,2})*)\)")

# Hinweiszeilen beginnen mit Auslassungspunkten. Steht am Ende eine Menge, gilt
# sie fuer alles darunter: `… von der Brauerei Flötzinger Rosenheim 0,5l`.
NOTE = re.compile(r"^[…\.]{1,4}")
TRAILING_PORTION = re.compile(r"(\d{1,2},\d{1,2}\s*l)\s*$")

# Reste, die sonst im Namen landen: die Groesse als eigenes Wort und das
# `jeweils` vor einem fuer mehrere Sorten geltenden Preis.
SIZE = re.compile(r"\s+(groß|klein)$")
EACH = re.compile(r"\s+jeweils$")

# Ab dieser Spalte beginnt keine Zeile mehr mit einem Namen. Was dort anfaengt
# und einen Preis traegt, ist die zweite Groesse des Getraenks darueber:
# `klein 3,50€` unter `Cappuccino groß 4,30€`.
PRICE_COLUMN = 400.0

# Innerhalb eines Weins liegen die Zeilen 17 pt auseinander, zwischen zwei
# Weinen 34 oder mehr.
WINE_GAP = 25.0

LEGEND = {
    "allergens": {
        "A": "gluten", "B": "crustaceans", "C": "eggs", "D": "fish",
        "E": "peanuts", "F": "soybeans", "G": "milk", "H": "nuts",
        "I": "celery", "J": "mustard", "K": "sesame", "L": "sulphites",
        "M": "lupin", "N": "molluscs",
    },
    "additives": {
        "1": "colorant", "2": "preservative", "3": "antioxidant",
        "4": "flavour_enhancer", "5": "sulphured", "6": "blackened",
        # Die Karte druckt `7 gewachst Phosphat` in einer Zeile und laesst die
        # 8 aus. Beide Marker kommen auf der Karte nicht vor.
        "7": "waxed",
        "9": "sweetener", "10": "milk_protein", "11": "caffeine",
        "12": "quinine",
    },
}


def section_at(page: int, top: float) -> str | None:
    hits = [title for start, title in GRAPHIC.get(page, []) if top >= start]
    return hits[-1] if hits else None


def open_section(sections: list[dict], title: str) -> bool:
    """Neuen Abschnitt beginnen, sofern nicht schon derselbe offen ist."""
    if sections and sections[-1]["title"] == title:
        return False
    sections.append({"title": title, "items": []})
    return True


def split_price(text: str) -> tuple[str, dict | None]:
    """Trennt den rechtsbuendigen Preis samt Menge vom Rest der Zeile."""
    m = TAIL.search(text)
    if not m:
        return text, None
    price = {"amount": float(m["price"].replace(",-", ".00").replace(",", ".")),
             "currency": "EUR"}
    if m["portion"]:
        price["portion"] = re.sub(r"\s+", "", m["portion"])
    return text[:m.start()].rstrip(), price


def clean(name: str) -> tuple[str, list[str], str | None]:
    """Name ohne Marker und Groessenwort, dazu beides einzeln."""
    markers: list[str] = []
    for m in MARKER.finditer(name):
        markers += [p.strip() for p in m[1].split(",")]
    name = MARKER.sub("", name).strip()
    size = None
    if m := SIZE.search(name):
        size, name = m[1], name[:m.start()]
    return EACH.sub("", name).strip(" ,"), markers, size


def read_drinks(rows: list[pdftext.Row], sections: list[dict]) -> int:
    last: Item | None = None
    portions: list[str] = []
    # Menge, die eine Hinweiszeile fuer alles darunter angesagt hat.
    default: str | None = None
    ignored = 0

    for row in rows:
        text = row.text.strip()
        if not text:
            continue
        if (title := section_at(row.page, row.top)) and open_section(sections, title):
            last, portions, default = None, [], None

        if NOTE.match(text):
            if m := TRAILING_PORTION.search(text):
                default = re.sub(r"\s+", "", m[1])
            last, portions = None, []
            continue
        if found := portion_header(text):
            portions, last = found, None
            continue
        if text.endswith(":"):
            # Zwischenzeilen wie `Whiskey:` oder `Badhorn Edel-Brände:`
            # gliedern innerhalb des Abschnitts, sind aber selbst keiner.
            last = None
            continue

        head, price = split_price(text)
        if price is None:
            if last is None:
                ignored += 1
            else:
                last.description = f"{last.description} {text}".strip()
            continue
        if row.x0 > PRICE_COLUMN and last is not None:
            price["portion"] = clean(head)[0] or price.get("portion", "")
            last.prices.append(price)
            continue

        # Der zweite Betrag steht jetzt am Ende des Restes: aus
        # `Tafelwasser 2,90€ 3,80€` ist `Tafelwasser 2,90€` geworden.
        head, first = split_price(head)
        prices = [first, price] if first else [price]
        name, markers, size = clean(head)
        if not name:
            ignored += 1
            continue
        if len(prices) == len(portions):
            for entry, portion in zip(prices, portions):
                entry["portion"] = portion
        elif len(prices) == 1 and "portion" not in price and (size or default):
            price["portion"] = size or default

        last = Item(name=name, prices=prices, markersRaw=markers)
        if not sections:
            open_section(sections, "Ohne Abschnitt")
        sections[-1]["items"].append(last)
    return ignored


def read_wine(rows: list[pdftext.Row], sections: list[dict]) -> int:
    last: Item | None = None
    previous = -1e9

    for row in rows:
        text = row.text.strip()
        if not text:
            continue
        if title := section_at(row.page, row.top):
            if open_section(sections, title):
                last = None
        elif max(w.height for w in row.words) >= HEADING_HEIGHT - 0.2:
            open_section(sections, text)
            last, previous = None, row.top
            continue

        head, price = split_price(text)
        body, markers, _ = clean(head)
        if last is None or row.top - previous > WINE_GAP:
            last = Item(name=body, prices=[price] if price else [], markersRaw=markers)
            if not sections:
                open_section(sections, "Ohne Abschnitt")
            sections[-1]["items"].append(last)
        else:
            if price:
                last.prices.append(price)
            if body:
                last.description = f"{last.description} {body}".strip()
            last.markersRaw += markers
        previous = row.top
    return 0


def parse() -> tuple[dict, int]:
    words = pdftext.words(PDF)
    sections: list[dict] = []
    ignored = 0
    for page in sorted({w.page for w in words}):
        if page in SKIP_PAGES:
            continue
        rows = pdftext.rows([w for w in words if w.page == page])
        ignored += (read_wine if page in WINE_PAGES else read_drinks)(rows, sections)
    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "westerberg-stubn",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Abschnittsüberschriften stehen als Grafik in der Karte und sind "
                 "von Hand übertragen",
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
