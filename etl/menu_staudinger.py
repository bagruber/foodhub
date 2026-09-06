"""Speisekarte des Staudinger Kellers in Moosburg, Stand 01.06.2026.

Einspaltig, sechzehn kleine Seiten. Die Ueberschriften sind an ihren
Unterstrichen zu erkennen, `_ Salate _`, und damit unabhaengig von der
Schriftgroesse, die zwischen 19,9 und 27 pt schwankt.

Die Karte kennt zwei Muster fuer ein Gericht, und welches gilt, haengt am
Abschnitt:

    Zwiebelrostbraten € 23,90                        Preis am Namen
    Färsenlende / Röstzwiebel / Speckbohnen

    Pizzabrot                                        Preis an den Zutaten
    mit Pizzasoße, Oregano und Olivenöl €5,50

Bei Burger, Pizza und Brotzeiten steht der Preis in der Zutatenzeile. Dort
laesst sich Name und Zutat nicht am Preis unterscheiden, deshalb an der Zeile
selbst: eine Zutatenzeile laeuft weit nach rechts oder trennt mit Schraegstrich,
ein Name tut beides nicht.

Die Getraenkeseiten fuehren die Menge vor dem Preis (`Hells Erdinger vom Fass
0,50 l € 4,40`) und die zweite Menge in einer eingerueckten Folgezeile.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/staudinger-keller_speisekarte_2026-06-01.pdf"
OUT = ROOT / "data/moosburg/menus/staudinger-keller_2026-06-01.json"
RETRIEVED = "2026-09-06"
URL = "https://www.staudingerkeller.de/"

HEADING = re.compile(r"^_\s*(.+?)\s*_$")

# Ab hier folgt nur noch die Lieferantenliste.
END = "Unsere Lieferanten"

# Abschnitte, in denen der Preis an der Zutatenzeile steht.
SPLIT = {"Burger", "Pizza", "Brotzeiten"}

# Zwei Abschnitte heiszen `Extras` und fuehren keine Gerichte, sondern
# Aufpreise: einmal Teller, Verpackung und Umbestellung, einmal Pizzabelag ab
# 0,40. In einer nach Preis sortierten Gerichteliste stehen sie sonst ganz
# oben, sechzehn Zeilen Kapern und Zwiebeln vor dem ersten Essen. `Extra
# Portion` bleibt: Kartoffelsalat und Bratkartoffeln kann man bestellen.
SKIP_SECTIONS = {"Extras"}

# Bis hierhin reicht ein Name, weiter nach rechts laeuft nur eine Zutatenzeile.
# `Cheeseburger 180g mit Pommes` endet bei 250, `200g hausgemachtes Bayern
# Pattie /` bei 255 und wird deshalb am Schraegstrich erkannt.
NAME_WIDTH = 260.0

# Eingerueckte Folgezeile mit der zweiten Menge: `Flasche 0,7 l € 26,90`.
# Ein Gericht beginnt immer bei 71.
INDENT = 150.0

PRICE = re.compile(
    r"\s*(?:(?P<portion>\d{1,2}[,.]?\d*\s*(?:l|cl|ml))\s*)?€\s*(?P<amount>\d{1,3}\s*,\s*\d{2})\s*$"
)
MARKER = re.compile(r"\s*\(\s*\d{1,2}(?:\s*,\s*\d{1,2})*\s*\)")

# Die Zeichenerklaerung steht mitten zwischen den Getraenken und wuerde sonst
# als Zutat am Haferl Kaffee haengen.
LEGEND_LINE = re.compile(r"^(Zusatzstoffe|Farbstoff$)")

LEGEND = {
    "allergens": {},
    # Von Seite 12: `Zusatzstoffe 10 = Koffein, 8 = Säuerungsmittel,
    # 7 = Süßungsmittel, 4 = Aromen, 3 Farbstoff`. Die Karte verwendet
    # zusaetzlich eine 1, ohne sie zu erklaeren; sie bleibt unbekannt.
    "additives": {
        "3": "colorant", "4": "flavouring", "7": "sweetener",
        "8": "acidifier", "10": "caffeine",
    },
}

VEGETARIAN_SECTIONS = {"Vegetarisch"}
VEGAN = re.compile(r"\(vegan\)", re.I)


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    # Name eines Gerichts, dessen Preis erst in einer der Zutatenzeilen steht,
    # und die Zutaten, die bis dahin aufgelaufen sind.
    pending: str | None = None
    body = ""
    ignored = 0

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        if not text or LEGEND_LINE.match(text):
            continue

        if m := HEADING.match(text):
            if m[1] == END:
                break
            # Die Pizzen laufen ueber zwei Seiten und tragen die Ueberschrift
            # zweimal. Ein zweiter Abschnitt gleichen Namens waere nur eine
            # Wiederholung in der Liste.
            if m[1] in SKIP_SECTIONS:
                sections.append({"title": m[1], "items": [], "skip": True})
            elif not sections or sections[-1]["title"] != m[1]:
                sections.append({"title": m[1], "items": []})
            last, pending, body = None, None, ""
            continue
        if not sections:
            continue

        split = sections[-1]["title"] in SPLIT
        head, price = read_price(text)

        if price is None:
            if split and row.x1 < NAME_WIDTH and "/" not in text:
                pending, body = text, ""
            elif pending is not None:
                # Zutaten vor dem Preis gehoeren zum wartenden Namen, nicht
                # zum Gericht darueber: sonst traegt `Vegetaria` die Zutaten
                # von `Tutto`.
                body = f"{body} {text}".strip()
            elif last is not None:
                last.description = f"{last.description} {text}".strip()
            else:
                ignored += 1
            continue

        if row.x0 > INDENT and last is not None and not pending:
            price["portion"] = price.get("portion") or head.strip()
            last.prices.append(price)
            continue

        name, markers = split_markers(pending or head)
        description = f"{body} {head}".strip() if pending else ""
        pending, body = None, ""
        last = Item(name=name, description=description, prices=[price], markersRaw=markers)
        sections[-1]["items"].append(last)

    return build(sections), ignored


def read_price(text: str) -> tuple[str, dict | None]:
    m = PRICE.search(text)
    if not m:
        return text, None
    # `Capricciosa ... €10 ,50`: die Karte setzt bei einem Preis ein
    # Leerzeichen vor das Komma.
    price = {"amount": float(re.sub(r"\s+", "", m["amount"]).replace(",", ".")),
             "currency": "EUR"}
    if m["portion"]:
        price["portion"] = re.sub(r"\s+", "", m["portion"])
    return text[:m.start()].rstrip(" ,"), price


def split_markers(text: str) -> tuple[str, list[str]]:
    markers: list[str] = []
    for m in MARKER.finditer(text):
        markers += re.findall(r"\d{1,2}", m[0])
    return MARKER.sub("", text).strip(" ,"), markers


def build(sections: list[dict]) -> dict:
    out = []
    for section in sections:
        if not section["items"] or section.get("skip"):
            continue
        base = {"vegetarian": "declared"} if section["title"] in VEGETARIAN_SECTIONS else {}
        items = []
        for item in section["items"]:
            diet = dict(base)
            if VEGAN.search(item.name):
                diet |= {"vegan": "declared", "vegetarian": "declared"}
            items.append(item.to_json(LEGEND, diet))
        out.append({"title": section["title"], "items": items})
    return {
        "restaurantId": "staudinger-keller",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Aufpreise aus den beiden Abschnitten 'Extras' nicht übernommen",
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
