"""Speisekarte von AN Asia Cuisine & Sushi in Moosburg, Stand 13.05.2026.

Sonderfall unter den vier Karten: das PDF hat keinen Textlayer, jede der 20
Seiten ist ein Bild in 300 dpi. `pdftotext` liefert daraus nichts, also wurde
der Text ausserhalb dieses Repos aus den Seiten ausgelesen und liegt als
`sources/moosburg/an-asia-cuisine_speisekarte_2026-05-13_extrakt.json`. Dieses
Skript raeumt ihn auf und bringt ihn in dieselbe Form wie die beiden gelesenen
Karten.

Was dabei wichtig ist: die Zuordnung wurde nicht Zeile fuer Zeile gegen das
Original geprueft. Anders als bei Drei Tannen und Maharaja steht hinter jedem
Wert kein nachvollziehbarer Schritt vom PDF zum Feld. Das steht so in der
Herkunft, damit es niemand spaeter fuer gepruefte Daten haelt.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/an-asia-cuisine_speisekarte_2026-05-13.pdf"
EXTRACT = ROOT / "sources/moosburg/an-asia-cuisine_speisekarte_2026-05-13_extrakt.json"
OUT = ROOT / "data/moosburg/menus/an-asia-cuisine_2026-05-13.json"
RETRIEVED = "2026-09-04"

# Das Auslesewerkzeug haengt an jeden Wert eine Fundstellenmarke.
CITE = re.compile(r"\s*\[cite:[^\]]*\]")
PRICE = re.compile(r"(\d{1,3}),(\d{2})")

# Die Karte zaehlt Allergene mit Buchstaben, ohne j, und Zusatzstoffe mit
# Zahlen. Nummer 18 fuehrt die Karte unter den Zusatzstoffen, obwohl
# Schalenfruechte ein Allergen sind; hier steht sie deshalb bei den Allergenen.
LEGEND = {
    "allergens": {
        "a": "gluten", "b": "crustaceans", "c": "eggs", "d": "fish",
        "e": "peanuts", "f": "soybeans", "g": "milk", "h": "nuts",
        "i": "celery", "k": "mustard", "l": "sesame", "m": "sulphites",
        "n": "lupin", "o": "molluscs", "18": "nuts",
    },
    "additives": {
        "1": "colorant", "2": "preservative", "3": "antioxidant",
        "4": "flavour_enhancer", "5": "sulphured", "6": "blackened",
        "7": "phosphate", "8": "sweetener", "9": "phenylalanine",
        "10": "waxed", "11": "nitrite_salt", "12": "tartrazine",
        "13": "genetically_modified", "14": "acidifier", "15": "stabiliser",
        "16": "protein", "17": "caffeine",
    },
}

# Ueberschriften der Karte, in der Form, in der sie dort stehen.
TITLES = {
    "mittagsgerichte": "Mittagsgerichte",
    "suppen": "Suppen",
    "vorspeisen": "Vorspeisen",
    "salat": "Salate",
    "hauptspeisen_gebratenes_huehnerfleisch": "Gebratenes Hühnerfleisch",
    "hauptspeisen_gebratenes_rindfleisch": "Gebratenes Rindfleisch",
    "hauptspeisen_ente_knusprig": "Ente knusprig",
    "hauptspeisen_haehnchen_knusprig": "Hähnchen knusprig",
    "hauptspeisen_garnelen_und_gemuese": "Garnelen und Gemüse",
    "hauptspeisen_nudeln_und_reis": "Nudeln und Reis",
    "hauptspeisen_tofu_gebraten": "Tofu gebraten",
    "hauptspeisen_spezial": "Spezialitäten",
    "beilagen": "Beilagen",
    "nachtisch": "Nachtisch",
    "sushi_maki": "Sushi: Maki",
    "sushi_inside_out": "Sushi: Inside Out",
    "sushi_crunchy": "Sushi: Crunchy",
    "sushi_spezialitaeten": "Sushi: Spezialitäten",
    "sushi_nigiri": "Sushi: Nigiri",
    "sushi_sashimi": "Sushi: Sashimi",
    "sushi_menue": "Sushi-Menüs",
}

# Gerichte, deren Name das Hauptprodukt nennt. Vegetarisch wird daraus
# abgeleitet, nicht von der Karte uebernommen, und ist deshalb `inferred`.
TOFU_SECTION = "hauptspeisen_tofu_gebraten"


def clean(value) -> str:
    return CITE.sub("", str(value or "")).strip()


def parse() -> dict:
    raw = json.loads(EXTRACT.read_text(encoding="utf-8"))
    sections = []
    for key, block in raw["speisekarte"].items():
        # Mal `{hinweis, gerichte}`, mal direkt die Liste.
        dishes = block.get("gerichte", []) if isinstance(block, dict) else block
        note = clean(block.get("hinweis")) if isinstance(block, dict) else ""
        diet = {"vegetarian": "inferred"} if key == TOFU_SECTION else None

        items = [read_dish(d).to_json(LEGEND, diet) for d in dishes]
        if not items:
            continue
        section = {"title": TITLES.get(key, key), "items": items}
        if note:
            section["note"] = note
        sections.append(section)

    return {
        "restaurantId": "an-asia-cuisine",
        "provenance": provenance(
            PDF, url=None, retrieved=RETRIEVED,
            note="Das PDF hat keinen Textlayer, jede Seite ist ein Bild. Der "
                 "Text wurde aus den Seiten ausgelesen und liegt daneben als "
                 "_extrakt.json. Die Zuordnung ist nicht Zeile fuer Zeile "
                 "gegen das Original geprueft. Quell-URL noch offen.",
        ),
        "legend": LEGEND,
        "sections": sections,
    }


def read_dish(raw: dict) -> Item:
    description = clean(raw.get("beschreibung"))
    # Die Sossenauswahl bringt eigene Allergene mit und gehoert deshalb an das
    # Gericht. Ein eigenes Feld dafuer waere verfrueht, solange nur diese eine
    # Karte es kennt, also steht sie in der Beschreibung.
    if auswahl := clean(raw.get("auswahl")):
        description = f"{description} Zur Wahl: {auswahl}".strip()
    if basis := clean(raw.get("preis_basis")):
        description = f"{description} Preisangabe: {basis}".strip()

    prices = []
    if m := PRICE.search(clean(raw.get("preis"))):
        prices = [{"amount": float(f"{m[1]}.{m[2]}"), "currency": "EUR"}]

    return Item(
        ref=clean(raw.get("nummer")) or None,
        name=clean(raw.get("name")),
        description=description,
        prices=prices,
        markersRaw=[m for m in re.findall(r"\d+|[a-z]", clean(raw.get("allergene")).lower())],
    )


if __name__ == "__main__":
    menu = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
