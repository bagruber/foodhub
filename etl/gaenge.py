"""Die gedruckte Abschnittsueberschrift einem Gang zuordnen.

Warum das noetig ist: die Gerichtsliste zeigt 1673 Gerichte aus sechzehn
Karten, und jede Karte gliedert anders. Nach Preis sortiert steht die
Knoblauchsauce fuer 40 Cent vor dem Schweinebraten, und wer nach einem
Hauptgericht sucht, scrollt an dreissig Bieren vorbei. Der Gang gibt der
Liste eine Reihenfolge, die aus dem Bestand selbst kommt und nicht aus dem
Preis.

Zugeordnet wird ueber `data/vocab/gaenge.json`: erst der volle Wortlaut, dann
geordnete Wortregeln. Geprueft wird auf ganze Woerter, sonst faende `eis` das
`Reis` und `drinks` das `Softdrinks`.

    python etl/gaenge.py            zeigt die Verteilung und was `andere` wird
"""

from __future__ import annotations

import json
import re
import sys
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT

VOCAB = ROOT / "data/vocab/gaenge.json"


@lru_cache(maxsize=1)
def table() -> dict:
    return json.loads(VOCAB.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def rules() -> list[tuple[str, re.Pattern[str]]]:
    out = []
    for gang, words in table()["regeln"]:
        alternatives = "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))
        out.append((gang, re.compile(rf"(?<!\w)(?:{alternatives})")))
    return out


def course_of(title: str) -> str:
    """Gang einer Abschnittsueberschrift. `andere`, wenn nichts passt."""
    if gang := table()["abschnitte"].get(title):
        return gang
    lowered = title.lower()
    for gang, pattern in rules():
        if pattern.search(lowered):
            return gang
    return "andere"


def main() -> int:
    import collections

    tally: collections.Counter[str] = collections.Counter()
    unmatched: dict[str, int] = {}
    for path in sorted((ROOT / "data/moosburg/menus").glob("*.json")):
        menu = json.loads(path.read_text(encoding="utf-8"))
        for section in menu["sections"]:
            gang = course_of(section["title"])
            tally[gang] += len(section["items"])
            if gang == "andere":
                unmatched[section["title"]] = len(section["items"])

    gaenge = table()["gaenge"]
    for slug in sorted(gaenge, key=lambda s: gaenge[s]["rang"]):
        print(f"  {gaenge[slug]['label']:22} {tally.get(slug, 0):5}")
    print(f"\n{sum(tally.values())} Gerichte insgesamt")
    if unmatched:
        print(f"\n{len(unmatched)} Überschriften ohne Regel:")
        for title, count in sorted(unmatched.items(), key=lambda x: -x[1]):
            print(f"  {count:4}  {title}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
