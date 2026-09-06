"""Speisekarte der Rosenhof-Lichtspiele in Moosburg, Kino mit Restaurant.

Aus Word, und die Karte hat genau drei Bauteile: Ueberschrift, Gericht mit
Preis am Zeilenende, Beschreibung darunter. Alles steht bei 14,0 pt, bis auf
die Ueberschriften. Die tragen einen Initial: `Salate` kommt als `S` bei
50,4 pt und `alate` bei 14,0 pt, deshalb wird das erste Wort einer
Ueberschrift ohne Leerzeichen an das zweite gehaengt.

Was diese Karte schwierig macht, sind die Variationen: unter vielen Gerichten
stehen Zusaetze mit Aufpreis, `+ Gegrillte Garnelen-Spieße (2 Stk.) + 8,50`.
Sie sind keine Gerichte, und ihre Aufpreise stehen im Ausdruck versetzt zu
ihren Zeilen, weil Word sie in einen eigenen Rahmen gesetzt hat. Sie fallen
deshalb ganz heraus. Erkennbar sind sie am Einzug: Gerichte und
Beschreibungen beginnen bei 36,0 pt, jede Variation weiter rechts.

Der Preis ist die letzte Zahl der Zeile, und er darf ganzzahlig sein: die
Kinderkarte fuehrt `Spätzle mit Soße 6`. Von den Zusatzstoffnummern
unterscheidet ihn der Schraegstrich, `kleiner Salat 3/5` ist kein Preis von
drei Euro. Eine Zeile ohne Preis ist die Beschreibung der Zeile darueber.

Die Zeichenerklaerung fehlt: die Karte verweist auf eine separate
Allergikerkarte. Die Nummern bleiben deshalb als `markersRaw` stehen, ohne
Deutung.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/rosenhof_speisekarte_2026.pdf"
OUT = ROOT / "data/moosburg/menus/rosenhof-lichtspiele_2026-08-07.json"
RETRIEVED = "2026-09-06"
URL = "https://www.rosenhof-lichtspiele.de/"

BODY, INITIAL = 14.0, 50.4
TOLERANCE = 0.5
# Gerichte und Beschreibungen beginnen hier. Alles weiter rechts ist eine
# Variation mit Aufpreis.
MARGIN = 45.0

# Zusatzstoffnummern, mit Schraegstrich verkettet: `3/5`, `3/5/14`, `/14`.
MARKERS = re.compile(r"\s(/?\d{1,2}(?:\s?/\s?\d{1,2})+)\s*$")
# Der Preis am Zeilenende. Zwei Betraege stehen fuer zwei Groessen,
# `Portion Pommes klein / groß 4 / 5,50`. Der Schraegstrich muss dort
# Leerzeichen um sich haben: `kleiner Salat 3/5` sind Zusatzstoffnummern und
# keine zwei Preise von drei und fuenf Euro.
PRICE = re.compile(r"\s(\d{1,3}(?:,\d{2})?(?:\s/\s\d{1,3}(?:,\d{2})?)?)\s*$")
AMOUNT = re.compile(r"\d{1,3}(?:,\d{2})?")
# `Salate – serviert mit unserem Hausdressing`
SPLIT = re.compile(r"\s+[–-]\s+")

LEGEND: dict[str, dict[str, str]] = {"allergens": {}, "additives": {}}


def heading(row: pdftext.Row) -> str | None:
    """Ueberschrift mit Initial. `S` + `alate` wird `Salate`."""
    if abs(max(w.height for w in row.words) - INITIAL) > TOLERANCE:
        return None
    words = [w.text for w in row.words]
    if len(words) > 1 and len(words[0]) == 1:
        words[:2] = [words[0] + words[1]]
    return " ".join(words)


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        if not text:
            continue

        if title := heading(row):
            parts = SPLIT.split(title, 1)
            sections.append({"title": parts[0].strip(),
                             "note": parts[1].strip() if len(parts) > 1 else None,
                             "items": []})
            last = None
            continue
        # Vor der ersten Ueberschrift steht die Begruessung, darunter der
        # Hinweis auf die Allergikerkarte. Beides ist keine Speise.
        if not sections:
            continue
        if abs(max(w.height for w in row.words) - BODY) > TOLERANCE:
            continue  # Fusszeile bei 11,0 pt
        if row.x0 > MARGIN:
            continue  # Variation mit Aufpreis

        # Zuerst der Preis, dann die Marker: sie stehen davor, nicht dahinter.
        # `Große gemischte Salatplatte 3/5 9,90`.
        prices = []
        if m := PRICE.search(text):
            prices = [{"amount": float(a.replace(",", ".")), "currency": "EUR"}
                      for a in AMOUNT.findall(m[1])]
            text = text[:m.start()].rstrip()

        markers: list[str] = []
        if m := MARKERS.search(text):
            markers = re.findall(r"\d{1,2}", m[1])
            text = text[:m.start()].rstrip()

        if prices:
            last = Item(name=text.strip(), prices=prices, markersRaw=markers)
            sections[-1]["items"].append(last)
        elif last is not None:
            last.description = f"{last.description} {text}".strip()
            last.markersRaw += markers
        else:
            ignored += 1

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    out = []
    for s in sections:
        if not s["items"]:
            continue
        entry = {"title": s["title"],
                 "items": [i.to_json(LEGEND) for i in s["items"]]}
        if s["note"]:
            entry = {"title": s["title"], "note": s["note"], "items": entry["items"]}
        out.append(entry)
    return {
        "restaurantId": "rosenhof-lichtspiele",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Die Karte verweist für Allergene auf eine separate "
                 "Allergikerkarte; die Nummern bleiben hier ohne Deutung. "
                 "Die Variationen mit Aufpreis sind nicht erfasst.",
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
