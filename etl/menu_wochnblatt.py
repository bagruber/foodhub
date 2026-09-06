"""Speisekarten des Café-Bistro Woch'nblatt in Moosburg.

Ein Ausdruck der Seite `speisekarten`, und darauf liegen vier Karten
uebereinander:

    Die "Schmankerl der Woche"        vom 02. - 06.09.2026
    Die Woch´nblatt-Wochenendkarte    vom 04. - 06.09.2026
    DIE WOCH´NBLATT-SAISONKARTE       Schwammerlzeit
    die stehende Karte                Suppen bis Was Süßes geht immer!

Die ersten beiden gelten wenige Tage. Das steht im Titel des Abschnitts und
in seiner Anmerkung, denn ein Preis ohne diese Angabe waere in einer Woche
falsch, ohne dass man es ihm ansaehe.

Getrennt wird an der Schriftgroesse: 14,7 pt eine der vier Karten, 14,9 pt ein
Abschnitt der stehenden Karte, 11,4 pt alles Uebrige. Ein Gericht endet, wo
ein Preis steht; die bis dahin gesammelten Zeilen sind Name und Beschreibung.
Beim Hirschbraten steht das Eurozeichen am Zeilenende und der Betrag in der
naechsten Zeile, deshalb wird erst zusammengefuegt und dann gesucht.

Die Zeichenerklaerung fehlt bewusst. Die Karte verweist auf
`/allergiker-im-woch-nblatt/`, und genau diesen Pfad sperrt die `robots.txt`
des Hauses. Geraten wird nicht, und hier waere es besonders verlockend: die
Buchstaben sehen aus wie die uebliche Reihe a bis n, sind es aber nicht. Auf
`Kugel Eis: Schoko, Erdbeere oder Vanille` steht `(d)`, und in der
Standardreihe waere das Fisch.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pdftext
from common import ROOT, Item, provenance, report, write_menu

PDF = ROOT / "sources/moosburg/caf-wochnblatt_speisekarte_2026-09-06.pdf"
OUT = ROOT / "data/moosburg/menus/caf-wochnblatt_2026-09-06.json"
RETRIEVED = "2026-09-06"
URL = "https://www.cafe-bistro-wochnblatt.de/speisekarten/"

CARD, SECTION, BODY = 14.7, 14.9, 11.4
TOLERANCE = 0.3
# Die Karte steht in der mittleren Spalte, die Navigation weiter links.
COLUMN = 200.0

PRICE = re.compile(r"€\s*(?P<amount>\d{1,3}),(?P<cents>\d{2})")
# Die Klammer am Ende und darin der Lauf aus Markern: `(a,d,i)`,
# `(5,a,d,e,i)`, `(scharf, a,i,l)`, `(ohne Bun a,d,i,l)`. Was davor in der
# Klammer steht, bleibt stehen: `(scharf)` ist eine Auskunft, kein Marker.
GROUP = re.compile(r"\(([^()]*)\)\s*(?P<tail>je)?\s*$")
RUN = re.compile(r"(?:^|(?<=[\s,]))((?:\d{1,2}|[a-z])(?:\s*,\s*(?:\d{1,2}|[a-z]))*)\s*$")

# Zeilen ohne Preis, die trotzdem kein Gerichtsname sind. Sie ueberschreiben
# eine Gruppe, sind aber genauso gesetzt wie alles andere: gleiche Schrift,
# gleiche Spalte, gleicher Einzug. Es gibt nichts, woran ein Programm sie
# erkennen koennte, deshalb stehen sie hier.
SUBHEADS = {"Kuchen", "Eis", "Desserts", "Käsegriller vom Haslacher"}

# Zeilen, die weder Speise noch Ueberschrift sind, sondern auf eine andere
# Karte verweisen. Ohne diese Liste wuerde die naechste Zeile mit Preis unter
# ihrem Namen stehen: die klare Rinderbruehe hiesse dann Wochensuppe.
DROP = {"Wochensuppe (siehe Mittagskarte)"}

# `vom 02. - 06.09.2026` unter dem Titel einer Karte. Beim ersten Vorkommen
# steht die Zeile in der Groesse des Fliesstextes, beim zweiten in der des
# Titels; deshalb wird sie am Wortlaut erkannt und nicht an der Groesse.
VALID = re.compile(r"^vom\s+\d{1,2}\.\s*[-–]\s*\d{1,2}\.\d{2}\.\d{4}$")

# Was zur Seite gehoert und nicht zur Karte.
CHROME = re.compile(r"^(Druckversion|©|Informationen zu Allergenen|unsere Frühstückskarte)")

LEGEND: dict[str, dict[str, str]] = {"allergens": {}, "additives": {}}


def markers_of(text: str) -> tuple[str, list[str]]:
    """Markerlauf aus der letzten Klammer holen, den Rest stehen lassen."""
    if not (group := GROUP.search(text)):
        return text, []
    if not (run := RUN.search(group[1])):
        return text, []
    marks = re.findall(r"\d{1,2}|[a-z]", run[1])
    rest = group[1][:run.start()].strip().strip(",").strip()
    head = text[:group.start()].rstrip()
    if group["tail"]:
        head = f"{head} {group['tail']}"
    return (f"{head} ({rest})" if rest else head), marks


def parse() -> tuple[dict, int]:
    sections: list[dict] = []
    buffer: list[str] = []
    ignored = 0
    card = section = sub = note = ""

    def open_section() -> dict:
        title = " · ".join(x for x in (card, section, sub) if x)
        if not sections or sections[-1]["title"] != title:
            sections.append({"title": title or "Ohne Abschnitt", "note": note, "items": []})
        return sections[-1]

    for row in pdftext.rows(pdftext.words(PDF)):
        text = row.text.strip()
        height = max(w.height for w in row.words)
        if not text or row.x0 < COLUMN or CHROME.match(text):
            continue

        if VALID.match(text):
            note = f"gültig {text}"
            buffer = []
            continue
        if abs(height - CARD) <= TOLERANCE:
            card, section, sub, note = text, "", "", ""
            buffer = []
            continue
        if abs(height - SECTION) <= TOLERANCE:
            section, sub, note = text, "", ""
            buffer = []
            continue
        if abs(height - BODY) > TOLERANCE:
            continue  # Hinweise und Verweise der Seite
        if text in DROP:
            buffer = []
            continue
        if text in SUBHEADS or text.endswith(":"):
            sub, ignored, buffer = text.rstrip(":"), ignored + len(buffer), []
            continue

        # Ein Spiegelstrich beginnt keine Speise, sondern eine Beilage zur
        # vorigen mit eigenem Preis: `- mit 6 Röstibällchen (Veggie) € 17,90`.
        variant = text.startswith("-") and not buffer

        buffer.append(text)
        joined = " ".join(buffer)
        if not (hits := list(PRICE.finditer(joined))):
            continue

        price = hits[-1]
        clean, marks = markers_of((joined[:price.start()] + joined[price.end():]).strip())
        amount = {"amount": float(f"{price['amount']}.{price['cents']}"), "currency": "EUR"}

        if variant and sections and sections[-1]["items"]:
            amount["note"] = clean.lstrip("- ").strip()
            sections[-1]["items"][-1].prices.append(amount)
            sections[-1]["items"][-1].markersRaw += marks
            buffer = []
            continue

        # Der Name ist die erste gesammelte Zeile, die Beschreibung der Rest.
        if len(buffer) == 1:
            name, description = clean, ""
        else:
            name = buffer[0]
            description = clean[len(name):].strip() if clean.startswith(name) else clean
        buffer = []
        open_section()["items"].append(
            Item(name=name.strip(), description=description, prices=[amount],
                 markersRaw=marks))

    return build(sections), ignored


def build(sections: list[dict]) -> dict:
    out = []
    for s in sections:
        if not s["items"]:
            continue
        entry: dict = {"title": s["title"]}
        if s.get("note"):
            entry["note"] = s["note"]
        entry["items"] = [i.to_json(LEGEND) for i in s["items"]]
        out.append(entry)
    return {
        "restaurantId": "caf-wochnblatt",
        "provenance": provenance(
            PDF, url=URL, retrieved=RETRIEVED,
            note="Ausdruck der Seite mit vier Karten. Die Zeichenerklärung "
                 "liegt unter /allergiker-im-woch-nblatt/, und diesen Pfad "
                 "sperrt die robots.txt des Hauses; die Marker bleiben "
                 "deshalb ohne Deutung.",
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
