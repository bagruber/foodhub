"""Speisekarte von Amrutham in Moosburg, Nachfolger von Tattva.

Die sauberste Karte im Bestand. Sie kommt aus WeasyPrint, und das zeigt sich:
jedes Gericht steht in einer Zeile, `Nummer Name Beschreibung Preis €`, und
die drei Teile sind an der Schriftgroesse zu trennen. Name 12,2 pt,
Beschreibung 10,5 pt, Preis 12,7 pt.

Die Allergenmarker kleben ohne Trennung am letzten Wort des Namens:
`Käsea,c,g`, `Linsensuppe8`, `Gulab Jamoong`. Nach Text allein ist das nicht
aufzuloesen, denn `Naan` endet auf ein `n`, und `N` ist in dieser Karte das
Zeichen fuer Weichtiere. Die Geometrie entscheidet stattdessen: ein Wort mit
hochgestelltem Zeichen misst 17,2 pt statt 12,2 pt, weil seine Box bis ueber
die Versalhoehe reicht. Nur bei diesen Woertern wird die Endung abgetrennt.

Die Abschnittsueberschriften stehen gesperrt, `VO R S P E I S E N`, und
pdftotext trennt an jeder Luecke. Zwischen zwei Buchstaben misst sie 1,5 pt,
zwischen zwei Woertern 6,5 pt: daran wird wieder zusammengesetzt.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/amrutham_speisekarte_2026-09-06.pdf"
OUT = ROOT / "data/moosburg/menus/amrutham_2026-09-06.json"
RETRIEVED = "2026-09-06"

SUBHEAD = 13.8
# Zwischen Name und Beschreibung. Der Preis liegt mit 12,7 pt zu nah am
# Namen, um ihn so zu trennen; er wird vorher am Eurozeichen erkannt.
SPLIT = 11.4
# Ab hier traegt ein Wort ein hochgestelltes Zeichen.
RAISED = 14.0

ORNAMENT = re.compile(r"[\U0001F395✦]")
# Luecke zwischen zwei Buchstaben desselben Worts einer gesperrten Zeile.
LETTER_GAP = 3.0

NUMBERED = re.compile(r"^(?P<ref>\d{1,3})\.$")
PRICE = re.compile(r"^(?P<amount>\d{1,3}),(?P<cents>\d{2})$")
PORTION = re.compile(r"^(?P<size>\d+,\d+)\s*l$", re.I)
SIZES = re.compile(r"^Größen:\s*(?P<rest>.+)$")
# Was am Ende eines hochgestellt gesetzten Wortes als Marker abgetrennt wird:
# ein Kleinbuchstabe oder eine Zahl, mit Komma verkettet. Bewusst weiter als
# die Zeichenerklaerung: `Spaghetti Napolic,s` traegt ein `s`, das die Karte
# nirgends erklaert. Die Geometrie sagt, dass dort ein Marker steht; was er
# bedeutet, ist eine zweite Frage, und dafuer gibt es `markersUnknown`.
TRAILING = re.compile(r"(?:[a-z]|\d{1,2})(?:,(?:[a-z]|\d{1,2}))*$")

LEGEND = {
    "allergens": {
        "A": "gluten", "B": "crustaceans", "C": "eggs", "D": "fish",
        "E": "peanuts", "F": "soybeans", "G": "milk", "H": "nuts",
        "I": "celery", "J": "mustard", "K": "sesame", "L": "sulphites",
        "M": "lupin", "N": "molluscs",
    },
    "additives": {
        "1": "colorant", "2": "caffeine", "3": "antioxidant",
        "4": "flavour_enhancer", "5": "sulphured", "6": "blackened",
        "7": "waxed", "8": "phosphate", "9": "sweetener",
        "10": "milk_protein", "11": "quinine", "12": "taurine",
        "13": "preservative",
    },
}


def heading(row: pdftext.Row) -> str | None:
    """Gesperrte Ueberschrift wieder zusammensetzen, Zierrat entfernen."""
    if not ORNAMENT.search(row.text):
        return None
    out: list[str] = []
    prev: float | None = None
    for w in row.words:
        if ORNAMENT.match(w.text):
            prev = w.x1
            continue
        if out and prev is not None and w.x0 - prev < LETTER_GAP:
            out[-1] += w.text
        else:
            out.append(w.text)
        prev = w.x1
    return " ".join(out).strip() or None


def demark(word: str) -> tuple[str, list[str]]:
    """Marker vom Wortende trennen. Nur fuer hochgestellt gesetzte Woerter."""
    if m := TRAILING.search(word):
        body = word[:m.start()]
        if body:
            return body, re.findall(r"\d{1,2}|[a-z]", m[0])
    return word, []


def split_row(ws: list[pdftext.Word]) -> tuple[str, list[str], str, list[dict]]:
    """Woerter einer Zeile in Name, Marker, Beschreibung und Preise zerlegen."""
    name: list[str] = []
    markers: list[str] = []
    description: list[str] = []
    amounts: list[dict] = []
    portion: str | None = None
    pending: float | None = None

    for w in ws:
        if w.text == "€":
            if pending is not None:
                amounts.append({"amount": pending, "currency": "EUR"})
                pending = None
            continue
        if m := PRICE.match(w.text):
            pending = float(f"{m['amount']}.{m['cents']}")
            continue
        if m := PORTION.match(w.text):
            portion = m["size"] + "l"
            continue
        if w.text == "—":
            # Leere Spalte der Pizzentabelle. Sie zaehlt mit, sonst rutschte
            # `— | 4,00 €` von Groß auf Normal.
            amounts.append(None)
            continue
        if w.text in ("|", "-"):
            continue
        if w.height < SPLIT:
            description.append(w.text)
        elif w.height > RAISED:
            body, marks = demark(w.text)
            name.append(body)
            markers += marks
        else:
            name.append(w.text)

    if portion:
        for a in amounts:
            if a:
                a["portion"] = portion
    return " ".join(name), markers, " ".join(description), amounts


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    last: Item | None = None
    ignored = 0
    portions: list[str] = []
    head, sub = "", ""

    def open_section() -> dict:
        title = f"{head} · {sub}" if sub else head
        if not sections or sections[-1]["title"] != title:
            sections.append({"title": title or "Ohne Abschnitt", "items": []})
        return sections[-1]

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        if not text:
            continue
        height = max(w.height for w in row.words)

        if title := heading(row):
            head, sub, last = title, "", None
            portions = []
            continue
        # Die Groessentabelle der Pizzen: `Normal (26cm) | Groß (30cm) | …`.
        if m := SIZES.match(text):
            portions = [p.strip().split(" ")[0] for p in m["rest"].split("|")]
            continue
        # Der Hinweis auf Aufpreise fuer Extras. Keine Gerichte.
        if text.startswith("*"):
            continue
        if text.isdigit():  # Seitenzahl
            continue
        if abs(height - SUBHEAD) <= 0.5:
            sub, last = text, None
            continue

        if m := NUMBERED.match(row.words[0].text):
            name, markers, description, amounts = split_row(row.words[1:])
            if portions:
                for a, p in zip(amounts, portions):
                    if a:
                        a["portion"] = p
            last = Item(ref=m["ref"], name=name, description=description,
                        prices=[a for a in amounts if a], markersRaw=markers)
            open_section()["items"].append(last)
            continue

        name, markers, description, amounts = split_row(row.words)
        amounts = [a for a in amounts if a]
        if amounts and name:
            # Die Getraenke stehen ohne Nummer, `Becks / Heineken 0,33l 3,50 €`.
            last = Item(name=name, description=description, prices=amounts,
                        markersRaw=markers)
            open_section()["items"].append(last)
        elif amounts and last is not None:
            # Nur eine zweite Menge mit Preis, `1,0l | 7,90 €`.
            last.prices += amounts
        elif last is not None and (name or description):
            # Umbruch: Name oder Beschreibung laufen in die naechste Zeile.
            if name:
                last.name = f"{last.name} {name}".strip()
                last.markersRaw += markers
            if description:
                last.description = f"{last.description} {description}".strip()
        else:
            ignored += 1

    return build(sections), ignored


def diet_of(title: str) -> dict:
    """Was der Abschnitt selbst ausweist.

    Aus dem Wortlaut wird nichts geschlossen: `Vegan möglich` in einer
    Beschreibung heisst nicht, dass das Gericht vegan ist, sondern dass es das
    auf Wunsch wird.
    """
    return {"vegetarian": "declared"} if "VEGETARISCH" in title.upper() else {}


def build(sections: list[dict]) -> dict:
    return {
        "restaurantId": "amrutham",
        # Ohne `url`: die Karte lag als Datei vor, eine Seite des Hauses ist
        # nicht bekannt. Ein geratener Link waere schlechter als keiner.
        "provenance": provenance(
            PDF, url=None, retrieved=RETRIEVED,
            note="Karte des Nachfolgers von Tattva am selben Ort. Als Datei "
                 "übergeben, eine Seite des Hauses ist nicht bekannt.",
        ),
        "legend": LEGEND,
        "sections": [
            {"title": s["title"],
             "items": [i.to_json(LEGEND, diet_of(s["title"])) for i in s["items"]]}
            for s in sections if s["items"]
        ],
    }


if __name__ == "__main__":
    menu, ignored = parse()
    write_menu(OUT, menu)
    print(f"{OUT.relative_to(ROOT)}")
    report(menu)
    print(f"    nicht zugeordnete Zeilen: {ignored}")
