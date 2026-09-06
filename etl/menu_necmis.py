"""Speisekarte von Necmi's Pizza and More in Moosburg.

Ein Ausdruck des Bestellshops (SIDES), 73 Seiten, davon 66 Karte und der Rest
Warenkorb, Cookie-Erklaerung und Impressum. Der Ausdruck bricht jedes Gericht
in einen eigenen Block auf:

    Drehspieß Sandwich          22,1 pt
    hausgemachtes Brot mit …    11,0 pt
    Produktinfos                11,0 pt
    7,50 €                      11,0 pt

Ueberschrift und Gerichtsname stehen beide bei 22,1 pt, die Schriftgroesse
trennt sie also nicht. Der Aufbau tut es: nach einem Gericht kommt ein Preis,
nach einer Ueberschrift sofort die naechste grosse Zeile. Danach wird
entschieden, und deshalb braucht es keine Liste der Abschnittsnamen.

Bei den Pizzen fuehrt der Shop zwei Groessen unter demselben Namen:
`Ø 29cm 9,50 €`, `Ø33cm 13,00 €`, `Ø33cm 23,50 €`. Das ist ein Fehler des
Shops, nicht des Ausdrucks. Uebernommen wird, was dort steht; erfunden wird
keine dritte Groesse.

`inkl. 0,25 € Pfand` und `12,25 € Pro Liter` sehen aus wie Preise und sind
keine. Sie fliegen ausdruecklich raus, sonst kostete die Fanta 25 Cent.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/necmis-pizza-and-more_speisekarte_2026-09-06.pdf"
OUT = ROOT / "data/moosburg/menus/necmis-pizza-and-more_2026-09-06.json"
RETRIEVED = "2026-09-06"
URL = "https://www.necmis-pizza.de/"

BIG = 22.1
TOLERANCE = 0.4

# Wo die Karte anfaengt und aufhoert. Davor Navigation und Warenkorb, danach
# Impressum und Cookie-Erklaerung.
START = "Zur Kasse"
END = "©"

PRICE = re.compile(r"^(?:ab\s+)?(?P<amount>\d{1,3}),(?P<cents>\d{2})\s*€$")
SIZED = re.compile(r"^(?P<portion>.+?)\s+(?P<amount>\d{1,3}),(?P<cents>\d{2})\s*€$")
# Was in der Preiszeile steht und kein Preis ist.
NOT_A_PRICE = re.compile(r"Pfand|Pro Liter|Mindestbestellwert|Rabatt|Summe")

LEGEND: dict[str, dict[str, str]] = {"allergens": {}, "additives": {}}


def blocks(rows: list[pdftext.Row]) -> list[tuple[str, list[str]]]:
    """Die Karte in Bloecke schneiden: eine grosse Zeile und was ihr folgt."""
    out: list[tuple[str, list[str]]] = []
    started = False
    for row in rows:
        text = row.text.strip()
        if not text:
            continue
        if not started:
            started = text.startswith(START)
            continue
        if text.startswith(END):
            break
        if abs(max(w.height for w in row.words) - BIG) <= TOLERANCE:
            out.append((text, []))
        elif out:
            out[-1][1].append(text)
    return out


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    ignored = 0

    for title, lines in blocks(pdftext.rows(pdftext.words(PDF))):
        description: list[str] = []
        amounts: list[dict] = []
        for line in lines:
            if line == "Produktinfos" or NOT_A_PRICE.search(line):
                continue
            if m := PRICE.match(line):
                amount = float(f"{m['amount']}.{m['cents']}")
                # `ab 9,50 €` wiederholt den kleinsten der Groessenpreise.
                # Er kommt zuerst, deshalb genuegt es, ihn nur zu nehmen,
                # solange noch kein Preis steht.
                if not amounts:
                    amounts.append({"amount": amount, "currency": "EUR"})
                continue
            if m := SIZED.match(line):
                amount = float(f"{m['amount']}.{m['cents']}")
                # Derselbe Shop schreibt `Ø 29cm` und `Ø29cm`. Das ist eine
                # Groesse, keine zwei.
                portion = re.sub(r"\s+", " ", m["portion"]).strip().replace("Ø ", "Ø")
                if amounts and amounts[0].get("portion") is None:
                    if amounts[0]["amount"] == amount:
                        amounts[0]["portion"] = portion
                        continue
                amounts.append({"amount": amount, "currency": "EUR", "portion": portion})
                continue
            description.append(line)

        if not amounts:
            # Ohne Preis ist es kein Gericht, sondern eine Ueberschrift.
            sections.append({"title": title, "items": []})
            ignored += len(description)
            continue
        if not sections:
            sections.append({"title": "Ohne Abschnitt", "items": []})
        sections[-1]["items"].append(
            Item(name=title, description=" ".join(description), prices=amounts))

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "necmis-pizza-and-more",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Ausdruck des Bestellshops. Allergene liegen dort hinter "
                 "„Produktinfos“ und stehen nicht im Ausdruck. Bei einigen "
                 "Pizzen führt der Shop zwei Preise unter derselben Größe.",
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
