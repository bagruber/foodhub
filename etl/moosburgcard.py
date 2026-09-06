"""Akzeptanzstellen der MoosburgCard in die Zahlungsarten eintragen.

Die MoosburgCard ist der Stadtgutschein von Moosburg Marketing, seit 2020 auch
kontaktlos zu bezahlen. Wer sie geschenkt bekommt, hat genau eine Frage: wo
kann ich damit essen gehen.

Eigenes Skript und nicht Teil von `osm.py`, weil es eine andere Quelle ist und
unabhaengig veraltet: Moosburg Marketing fuehrt die Liste, Betriebe kommen dazu
und fallen weg. Eigenes Skript und nicht allgemein, weil solche Stadtgutscheine
ortsgebunden sind. Eine zweite Stadt bekommt ihr eigenes Skript fuer ihr
eigenes System, das Datenmodell bleibt wie es ist.

Die Liste wird gelesen, nicht gepflegt: bei jedem Lauf frisch geholt, damit das
Abrufdatum stimmt. Zugeordnet wird ueber den Namen, und was nicht eindeutig
passt, wird gemeldet statt geraten.

    python etl/moosburgcard.py moosburg
"""

from __future__ import annotations

import html
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT
from osm import normalise, write_json

URL = "https://meinmoosburg.de/einkaufen/m-card/"
AGENT = "foodhub/0.1 (+https://github.com/bagruber/foodhub)"
SLUG = "moosburg_card"

# Die Liste steht als Fliesstext unter dieser Ueberschrift, ein Betrieb je
# Zeile. Kein Markup, an dem sich die Eintraege erkennen liessen, deshalb der
# Abschnitt und dann Zeile fuer Zeile.
HEADING = re.compile(r"Wo kann ich.{0,60}bezahlen", re.S | re.I)
END = re.compile(r"Guthaben-Abfrage|Guthaben\s*abfragen", re.I)


def acceptors() -> list[str]:
    request = urllib.request.Request(URL, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        page = response.read().decode("utf-8", "replace")

    start = HEADING.search(page)
    if not start:
        raise SystemExit("Abschnitt mit den Akzeptanzstellen nicht gefunden")
    chunk = page[start.end():]
    if stop := END.search(chunk):
        chunk = chunk[:stop.start()]

    text = html.unescape(re.sub(r"<[^>]+>", "\n", chunk))
    out = []
    for line in (l.strip() for l in text.split("\n")):
        # Klammerzusaetze wie `(ausgenommen rezeptpflichtige Medikamente)`
        # stehen als eigene Zeile und sind kein Betrieb.
        if len(line) > 2 and not line.startswith("(") and any(c.isalpha() for c in line):
            out.append(line)
    return out


def main(city_id: str) -> int:
    city_dir = ROOT / "data" / city_id
    today = date.today().isoformat()
    names = acceptors()
    print(f"{len(names)} Akzeptanzstellen gelesen")

    by_name = {normalise(n): n for n in names}
    prov = {
        "kind": "website", "url": URL, "retrievedAt": today,
        "note": "Liste der Akzeptanzstellen bei Moosburg Marketing",
    }

    hits = 0
    for path in sorted((city_dir / "restaurants").glob("*.json")):
        r = json.loads(path.read_text(encoding="utf-8"))
        key = normalise(r["name"])
        # Wie bei den Bewertungen: erst gleicher Name, dann eindeutig
        # enthaltener. `Café Woch'nblatt` heisst dort `Café Bistro Woch'nblatt`.
        listed = by_name.get(key)
        if listed is None and len(key) >= 6:
            near = {v for k, v in by_name.items() if key in k or k in key}
            listed = next(iter(near)) if len(near) == 1 else None

        payment = dict(r.get("payment") or {})
        if listed:
            payment[SLUG] = {"accepted": True, "provenance": dict(prov)}
            hits += 1
            print(f"  + {r['name'][:32]:34} als '{listed}'")
        else:
            # Nicht auf der Liste heisst nicht angenommen, und das ist eine
            # Auskunft. Aber nur fuer Haeuser, die wir schon gefragt haben:
            # ein frueherer Eintrag wird zurueckgenommen, ein fehlender bleibt
            # fehlend. Sonst stuende an 43 Haeusern eine Verneinung, die nur
            # heisst, dass wir nichts wissen.
            payment.pop(SLUG, None)
        if payment:
            r["payment"] = payment
        write_json(path, r)

    print(f"\n{hits} Häuser nehmen die MoosburgCard")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "moosburg"))
