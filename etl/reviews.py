"""Bewertungen und Links zu den Bewertungsportalen.

Was von den drei Anbietern geht, und warum nur einer davon eingesammelt wird:

*   **Restaurant Guru** erlaubt es. Die `robots.txt` sperrt `/search*` und
    `/*/reviews*`, die Stadtliste und die Hausseiten aber nicht, und setzt
    `Crawl-delay: 1`. Daran haelt sich `PAUSE`. Von dort kommen Note, Anzahl
    der Stimmen und der Link.
*   **Google Maps** wird nur verlinkt, nicht gelesen. `robots.txt` sperrt
    `/maps/` bis auf wenige Ausnahmen, darunter ausdruecklich `/maps/?q=`, und
    genau die Form ist ein Link. Fuer die Bewertungszahl braeuchte es die
    Places API mit Schluessel und Abrechnung, und deren Bedingungen erlauben
    kein dauerhaftes Speichern der Werte. Das passt nicht zu einem Repo, dessen
    Zweck es ist, Angaben mit Abrufdatum aufzubewahren.
*   **Tripadvisor** wird gar nicht abgefragt. Die Seite antwortet auf jede
    nicht-Browser-Anfrage mit HTTP 403 hinter einer Bot-Sperre, und die
    Nutzungsbedingungen untersagen automatisierten Zugriff unabhaengig von der
    Menge. Links dorthin muessen von Hand eingetragen werden.

Die Bewertungen sind fremde Meinungen. Das Repo gibt sie mit Quelle und
Abrufdatum weiter und macht sie sich nicht zu eigen.

    python etl/reviews.py moosburg
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT
from osm import normalise, write_json

GURU = "https://de.restaurantguru.com/{slug}"
PAUSE = 1.0  # Sekunden, wie in der robots.txt verlangt

# Ein Browser-Kennzeichen waere hier eine Luege. Wer die Anfrage sieht, soll
# erkennen, wer fragt und wo er nachlesen kann.
AGENT = "foodhub/0.1 (+https://github.com/bagruber/foodhub)"

# Eine Karte auf der Stadtliste beginnt mit `card__title` und traegt Name,
# Link, Note und Stimmenzahl. Geteilt statt am Stueck gelesen: das Wort steht
# auch im eingebetteten Stylesheet, und ein Ausdruck ueber die ganze Seite
# beginnt dort und verschluckt alles bis zur letzten Karte.
LINK = re.compile(r'title="(?P<name>[^"]+)"\s+href="(?P<url>https://[^"]+)"')
STARS = re.compile(r'card__rating-star">\s*([\d,.]+)\s*<')
VOTES = re.compile(r'card__votes">\s*([\d.\s]+)\s*(?:Stimmen|votes)')

# Dieselbe Karte steht mehrfach auf der Seite, einmal frei und einmal in einer
# Bestenliste, dort mit dem Rang davor: `7. Alexander The Great`. Ohne das weg
# heisst das Haus `7alexanderthegreat` und trifft nichts.
RANK = re.compile(r"^\d{1,3}\.\s*")

# Wie kurz ein Name werden darf, bevor Teilstringvergleich gefaehrlich wird.
# `Moosi` faende sonst jedes Haus mit `Moosburg` im Namen.
MIN_STEM = 6

# Von Hand geprueft, weil der Namensvergleich hier danebenliegt. `None` heisst:
# kein Eintrag, auch wenn etwas passt.
#
# Nicht in der Liste, weil nachgesehen und richtig: `LariFari` und `Necmi's
# Pizza and More` stehen bei Restaurant Guru unter ihrem heutigen Namen, aber
# noch unter dem alten Adressschnipsel (`BB-Lounge`, `Necmis-Catering`). Das
# sieht falsch aus und ist es nicht.
OVERRIDE: dict[str, str | None] = {
    # Wiesender hat in Moosburg mehrere Haeuser: die Bäckerei in der Neuen
    # Industriestrasse, das Café am Stadtplatz und die Naturbackstube. Guru
    # fuehrt die dritte, und welche der beiden anderen damit gemeint waere,
    # ist nicht zu entscheiden. Also keine.
    "wiesender-caf": None,
}


def get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def guru_pages(city_slug: str, limit: int = 12) -> list[str]:
    """Die Stadtliste, Seite fuer Seite, solange `rel="next"` weiterzeigt."""
    pages, url = [], GURU.format(slug=city_slug)
    seen: set[str] = set()
    while url and url not in seen and len(pages) < limit:
        seen.add(url)
        pages.append(get(url))
        nxt = re.search(r'rel="next"\s+href="([^"]+)"', pages[-1])
        url = html.unescape(nxt[1]) if nxt else ""
        if url:
            time.sleep(PAUSE)
    return pages


def cards(page: str) -> list[dict]:
    out = []
    for chunk in page.split("card__title")[1:]:
        link = LINK.search(chunk)
        if not link:
            continue
        entry = {"name": RANK.sub("", html.unescape(link["name"]).strip()),
                 "url": html.unescape(link["url"]).strip()}
        if stars := STARS.search(chunk):
            entry["value"] = float(stars[1].replace(",", "."))
        if votes := VOTES.search(chunk):
            entry["count"] = int(re.sub(r"\D", "", votes[1]))
        out.append(entry)
    return out


def maps_url(restaurant: dict) -> str:
    """Suchlink auf Google Maps, aus Name und Anschrift.

    Kein Ortskennzeichen (`place_id`), weil das die Places API braucht. Der
    Suchlink findet dasselbe Haus und ist die Form, die Google in seiner
    `robots.txt` ausdruecklich erlaubt.
    """
    address = restaurant.get("address") or {}
    query = " ".join(x for x in (restaurant["name"], address.get("street"),
                                 address.get("city")) if x)
    return "https://www.google.com/maps/?q=" + urllib.parse.quote(query)


def match(name: str, found: dict[str, dict]) -> dict | None:
    """Erst den gleichen Namen, dann den eindeutig enthaltenen.

    Restaurant Guru fuehrt viele Haeuser ausfuehrlicher als wir: aus `Maharaja`
    wird dort `Maharaja - Indisches Restaurant und Lieferservice`, aus
    `Alexander The Great` das mit `Griechisches Restaurant` dahinter. Deshalb
    der zweite Durchgang ueber Enthaltensein.

    Er greift nur, wenn genau ein Haus passt. Zwei Kandidaten heisst nicht
    zugeordnet: eine falsch angehaengte Note steht unter dem Namen des falschen
    Hauses, und das ist schlimmer als eine fehlende.
    """
    if hit := found.get(name):
        return hit
    if len(name) < MIN_STEM:
        return None
    hits = [v for k, v in found.items() if name in k or (len(k) >= MIN_STEM and k in name)]
    urls = {h["url"] for h in hits}
    return hits[0] if len(urls) == 1 else None


def merge(existing: list[dict], entry: dict) -> list[dict]:
    """Eintrag derselben Quelle ersetzen, fremde stehen lassen.

    Von Hand eingetragene Tripadvisor-Links duerfen ein Lauf hier nicht
    wegwerfen.
    """
    return [e for e in existing if e.get("source") != entry["source"]] + [entry]


def main(city_id: str) -> int:
    city_dir = ROOT / "data" / city_id
    city = json.loads((city_dir / "city.json").read_text(encoding="utf-8"))
    today = date.today().isoformat()

    slug = city.get("guru") or city["name"].split()[0]
    # Faellt die Stadtliste aus, bleiben die vorhandenen Guru-Eintraege stehen
    # und nur die Kartenlinks werden erneuert. Besser als ein Abbruch, der auch
    # das Gelungene wegwirft.
    try:
        pages = guru_pages(slug)
    except Exception as fehler:
        print(f"Restaurant Guru nicht erreichbar ({fehler}), Eintraege bleiben wie sie sind")
        pages = []
    found: dict[str, dict] = {}
    for page in pages:
        for card in cards(page):
            key = normalise(card["name"])
            # Dasselbe Haus steht mehrfach auf der Seite. Der Eintrag mit den
            # meisten Stimmen ist der vollstaendigere.
            if card.get("count", 0) >= found.get(key, {}).get("count", -1):
                found[key] = card
    print(f"{len(pages)} Seiten bei Restaurant Guru, {len(found)} Haeuser gelesen")

    hits = misses = 0
    for path in sorted((city_dir / "restaurants").glob("*.json")):
        r = json.loads(path.read_text(encoding="utf-8"))
        reviews = list(r.get("reviews") or [])

        reviews = merge(reviews, {
            "source": "google_maps",
            "url": maps_url(r),
            "provenance": {
                "kind": "google_maps", "url": maps_url(r), "retrievedAt": today,
                "note": "Suchlink aus Name und Anschrift, keine Bewertung abgerufen",
            },
        })

        forced = OVERRIDE.get(r["id"], "")
        card = None if forced is None else (
            {"name": r["name"], "url": forced} if forced
            else match(normalise(r["name"]), found))
        if not pages:
            card = None  # ohne frische Liste nichts anfassen
        if card:
            entry = {
                "source": "restaurantguru",
                "url": card["url"],
                "provenance": {
                    "kind": "restaurantguru", "url": card["url"], "retrievedAt": today,
                    "note": "Fremde Bewertung, von Restaurant Guru übernommen",
                },
            }
            if "value" in card:
                entry["rating"] = {"value": card["value"], "scale": 5}
                if "count" in card:
                    entry["rating"]["count"] = card["count"]
            reviews = merge(reviews, entry)
            hits += 1
            note = f'{card.get("value", "-")} ({card.get("count", "-")})'
            print(f"  + {r['name'][:32]:34} {note}")
        else:
            misses += 1

        r["reviews"] = sorted(reviews, key=lambda e: e["source"])
        write_json(path, r)

    print(f"\n{hits} zugeordnet, {misses} ohne Eintrag bei Restaurant Guru")
    print("Tripadvisor bleibt leer, siehe Modulkopf")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "moosburg"))
