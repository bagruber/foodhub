"""Speisekarte von Asia Rose in Moosburg, Karte vom 28.04.2022.

Wie bei AN Asia hat das PDF keinen Textlayer: die Schrift ist in Kurven
umgewandelt, `pdftotext` liefert daraus nichts. Der Text wurde ausserhalb
dieses Repos aus den Seiten ausgelesen und liegt als
`sources/moosburg/asia-rose_speisekarte_2022-04-28_extrakt.json`.

Zwei Dinge stehen deshalb in der Herkunft und muessen dort stehen bleiben.
Erstens ist die Zuordnung nicht Zeile fuer Zeile gegen das Original geprueft,
anders als bei den Karten, die hier gelesen werden. Zweitens ist die Karte vier
Jahre alt: das Erstelldatum aus den PDF-Metadaten liegt 2022, und die App
rechnet ihr Alter daraus und nicht aus dem Abrufdatum.

Der Aufbau des Extrakts weicht vom AN-Asia-Extrakt ab, obwohl beide vom selben
Werkzeug stammen: hier eine Liste aus `{kategorie, gerichte}`, dort ein Objekt
mit Abschnitts-Schluesseln. Deshalb ein eigenes Skript und kein gemeinsames.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/asia-rose_speisekarte_2022-04-28.pdf"
EXTRACT = ROOT / "sources/moosburg/asia-rose_speisekarte_2022-04-28_extrakt.json"
OUT = ROOT / "data/moosburg/menus/asia-rose_2022-04-28.json"
RETRIEVED = "2026-09-06"

# Das Auslesewerkzeug haengt an jeden Wert eine Fundstellenmarke.
CITE = re.compile(r"\s*\[cite:[^\]]*\]")
PRICE = re.compile(r"(\d{1,3}),(\d{2})")

# Marker stehen gemischt in einem Feld: `4,11,a` oder `4,8,8,g`. Buchstabe mit
# angehaengter Ziffer ist ein Unterfall (`h2` sind Haselnuesse), deshalb steht
# diese Form in der Alternative vorn.
MARKER = re.compile(r"[a-z]\d?|\d+")

# Die Karte teilt Gluten und Schalenfruechte weiter auf, als die LMIV es
# verlangt: `a1` bis `a4` sind Weizen, Roggen, Gerste und Hafer, `h1` bis `h8`
# einzelne Nussarten. Fuer die Suche ist das eine Verfeinerung ohne Nutzen, wer
# Nuesse meidet, meidet alle. Sie laufen deshalb auf ihr Oberallergen. `al` ist
# kein eigener Code, sondern `a1` mit einem l gelesen.
LEGEND = {
    "allergens": {
        "a": "gluten", "al": "gluten", "a1": "gluten", "a2": "gluten",
        "a3": "gluten", "a4": "gluten",
        "b": "crustaceans", "c": "eggs", "d": "fish", "e": "peanuts",
        "f": "soybeans", "g": "milk",
        "h": "nuts", "h1": "nuts", "h2": "nuts", "h3": "nuts", "h4": "nuts",
        "h5": "nuts", "h6": "nuts", "h7": "nuts", "h8": "nuts",
        "i": "celery", "j": "mustard", "k": "sesame", "l": "sulphites",
        "m": "lupin", "n": "molluscs",
    },
    "additives": {
        "1": "colorant", "2": "preservative", "3": "antioxidant",
        "4": "flavour_enhancer", "5": "sulphured", "6": "blackened",
        "7": "phosphate", "8": "milk_protein", "9": "caffeine",
        "10": "quinine", "11": "sweetener", "12": "phenylalanine",
        "13": "waxed", "14": "nitrite_salt", "15": "taurine",
        "16": "acidifier", "17": "tartrazine", "18": "surimi",
    },
}


def clean(value) -> str:
    return CITE.sub("", str(value or "")).strip()


def read_dish(raw: dict) -> Item:
    prices = []
    if m := PRICE.search(clean(raw.get("preis"))):
        prices = [{"amount": float(f"{m[1]}.{m[2]}"), "currency": "EUR"}]

    # `eigenschaften` kommt als Zeichenkette einer Liste an: `['scharf']`.
    props = clean(raw.get("eigenschaften")).lower()
    spice = {"level": 2, "basis": "declared"} if "scharf" in props else None

    return Item(
        ref=clean(raw.get("nummer")) or None,
        name=clean(raw.get("name")),
        description=clean(raw.get("beschreibung")),
        prices=prices,
        markersRaw=MARKER.findall(clean(raw.get("allergene_zusatzstoffe")).lower()),
        diet={"vegetarian": "declared"} if "vegetarisch" in props else {},
        spice=spice,
    )


def parse() -> dict:
    raw = json.loads(EXTRACT.read_text(encoding="utf-8"))
    sections = []
    for block in raw["speisekarte"]:
        # Vegetarisch wird hier nicht geschlossen. Der erste Versuch danach
        # ueber Woerter in der Beschreibung machte aus `CHICKEN-SUPPE mit
        # Gemüse` ein vegetarisches Gericht: in dieser Kueche steht Gemuese in
        # fast jeder Beschreibung, neben dem Fleisch. Die Karte selbst sagt
        # dazu nichts, also sagen wir auch nichts.
        items = [read_dish(entry).to_json(LEGEND) for entry in block["gerichte"]]
        if items:
            sections.append({"title": clean(block["kategorie"]).title(), "items": items})

    return {
        "restaurantId": "asia-rose",
        "provenance": provenance(
            PDF, url=None, retrieved=RETRIEVED,
            note="Das PDF hat keinen Textlayer, die Schrift ist in Kurven "
                 "umgewandelt. Der Text wurde aus den Seiten ausgelesen und "
                 "liegt daneben als _extrakt.json. Die Zuordnung ist nicht "
                 "Zeile für Zeile gegen das Original geprüft. Die Karte ist "
                 "von 2022, Preise entsprechend unsicher. Quell-URL offen.",
        ),
        "legend": LEGEND,
        "sections": sections,
    }


if __name__ == "__main__":
    menu = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
