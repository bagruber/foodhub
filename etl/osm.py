"""Koordinaten und Stammdaten aus OpenStreetMap holen, über Overpass.

Warum OSM und nicht Google: es braucht keinen Schlüssel, kostet nichts, setzt
keine Cookies und erlaubt anders als die Places-Terms, die Angaben dauerhaft zu
speichern. Es liefert keine Bewertungen, aber alles andere: Koordinaten,
Adresse, `opening_hours`, `cuisine`, Website, Telefon.

Die Zuordnung läuft beim ersten Lauf über den normalisierten Namen und schreibt
danach die OSM-Kennung in die Restaurantdatei. Ab dann zählt die Kennung, denn
Namen ändern sich, und `Drei Tannen` in OSM ist derselbe Gasthof wie
`Gasthof Drei Tannen` hier.

Lizenz: ODbL. Wer die Daten zeigt, nennt „© OpenStreetMap-Mitwirkende".

    python etl/osm.py moosburg
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT

ENDPOINT = "https://overpass-api.de/api/interpreter"
AMENITIES = "restaurant|fast_food|cafe|pub|bar|biergarten|ice_cream"

QUERY = """[out:json][timeout:30];
(
  nwr["amenity"~"^({amenities})$"]({south},{west},{north},{east});
);
out center tags;
"""


def normalise(name: str) -> str:
    """Namen vergleichbar machen: Kleinschreibung, ohne Gattungswort und Beiwerk.

    `Gasthof Drei Tannen` und `Drei Tannen` sind dasselbe Haus, `AN Asia
    Cuisine & Sushi` und `An Asia Cuisine & Sushi` auch.
    """
    name = name.lower()
    name = re.sub(r"\b(gasthof|gasthaus|restaurant|cafe|café|hotel|zum|zur)\b", " ", name)
    return re.sub(r"[^a-z0-9äöüß]+", "", name)


def fetch(city: dict) -> dict:
    west, south, east, north = city["bbox"]
    query = QUERY.format(amenities=AMENITIES, south=south, west=west, north=north, east=east)
    request = urllib.request.Request(
        ENDPOINT, data=query.encode("utf-8"),
        headers={"User-Agent": "foodhub/0.1 (github.com/bagruber/foodhub)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def coordinates(element: dict) -> tuple[float, float] | None:
    if "lat" in element:
        return element["lat"], element["lon"]
    if center := element.get("center"):
        return center["lat"], center["lon"]
    return None


def main(city_id: str) -> int:
    city_dir = ROOT / "data" / city_id
    city = json.loads((city_dir / "city.json").read_text(encoding="utf-8"))
    today = date.today().isoformat()

    raw = fetch(city)
    dump = ROOT / "sources" / city_id / f"osm_{today}.json"
    dump.parent.mkdir(parents=True, exist_ok=True)
    dump.write_text(json.dumps(raw, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    elements = [e for e in raw["elements"] if e.get("tags", {}).get("name")]
    print(f"{len(elements)} benannte Gaststätten in OSM, gesichert in {dump.relative_to(ROOT)}")

    by_id = {f"{e['type']}/{e['id']}": e for e in elements}
    by_name: dict[str, list[dict]] = {}
    for e in elements:
        by_name.setdefault(normalise(e["tags"]["name"]), []).append(e)

    matched: set[str] = set()
    for path in sorted((city_dir / "restaurants").glob("*.json")):
        r = json.loads(path.read_text(encoding="utf-8"))
        hit = by_id.get(r.get("osm") or "")
        if hit is None:
            candidates = by_name.get(normalise(r["name"]), [])
            if len(candidates) != 1:
                print(f"  ? {r['name']}: {len(candidates)} Treffer, nicht zugeordnet")
                continue
            hit = candidates[0]

        key = f"{hit['type']}/{hit['id']}"
        matched.add(key)
        if not (pos := coordinates(hit)):
            print(f"  ? {r['name']}: Objekt ohne Koordinaten")
            continue

        r["osm"] = key
        r["location"] = {
            "lat": round(pos[0], 6),
            "lon": round(pos[1], 6),
            "provenance": {
                "kind": "osm",
                "url": f"https://www.openstreetmap.org/{key}",
                "retrievedAt": today,
                "note": "© OpenStreetMap-Mitwirkende, ODbL",
            },
        }
        if offen := r.get("open"):
            r["open"] = [x for x in offen if x != "Koordinaten fehlen"]
            if not r["open"]:
                del r["open"]
        path.write_text(json.dumps(r, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        tags = hit["tags"]
        extra = [k for k in ("opening_hours", "phone", "website", "cuisine") if k in tags]
        print(f"  + {r['name']:26} {key:16} {pos[0]:.5f}, {pos[1]:.5f}  hat: {', '.join(extra) or '-'}")

    rest = [e for k, e in by_id.items() if k not in matched]
    print()
    print(f"{len(rest)} weitere Gaststätten in OSM ohne eigenen Eintrag:")
    taken = {p.stem for p in (city_dir / "restaurants").glob("*.json")}
    added = 0
    for e in sorted(rest, key=lambda e: e["tags"]["name"]):
        entry = draft(e, city_id, today)
        if entry is None:
            print(f"    ? {e['tags']['name']}: ohne Koordinaten, übersprungen")
            continue
        # Zwei Häuser können denselben Namen tragen, der Fliegerclub führt
        # Wirtschaft und Biergarten getrennt. Die OSM-Kennung hängt dann an,
        # damit keiner den anderen überschreibt.
        if entry["id"] in taken:
            entry["id"] += "-" + str(e["id"])
        taken.add(entry["id"])
        path = city_dir / "restaurants" / f"{entry['id']}.json"
        write_json(path, entry)
        added += 1
    print(f"    {added} angelegt, nur mit dem, was OSM belegt")
    return 0


# Aus welchem `amenity` welche Küche folgt, wenn OSM keine `cuisine` führt.
# Die Art des Hauses ist keine Küche, aber ohne Eintrag stünde ein Café ganz
# ohne Merkmal auf der Karte und wäre über keinen Filter zu finden.
FROM_AMENITY = {
    "cafe": "cafe", "bar": "bar", "pub": "pub",
    "biergarten": "beer_garden", "fast_food": "fast_food",
    "ice_cream": "ice_cream",
}


def slugify(name: str) -> str:
    out = name.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"), ("´", ""), ("'", "")):
        out = out.replace(a, b)
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", out)).strip("-")


def draft(element: dict, city_id: str, today: str) -> dict | None:
    """Stammdaten aus einem OSM-Objekt, für Häuser ohne eigene Datei.

    Bewusst nur, was OSM belegt. Keine Speisekarte, keine Bewertung, und die
    Herkunft steht an Ort und Öffnungszeiten, damit später sichtbar bleibt,
    dass dieses Haus nicht von uns erfasst, sondern übernommen wurde.
    """
    tags = element["tags"]
    if not (pos := coordinates(element)):
        return None
    key = f"{element['type']}/{element['id']}"

    note = "© OpenStreetMap-Mitwirkende, ODbL"
    if check := tags.get("check_date"):
        note += f". Zuletzt in OSM bestätigt am {check}."
    prov = {"kind": "osm", "url": f"https://www.openstreetmap.org/{key}",
            "retrievedAt": today, "note": note}

    cuisines = [c for c in tags.get("cuisine", "").split(";") if c]
    if from_amenity := FROM_AMENITY.get(tags.get("amenity", "")):
        if from_amenity not in cuisines:
            cuisines.append(from_amenity)

    address = {}
    if street := tags.get("addr:street"):
        address = {
            "street": f"{street} {tags.get('addr:housenumber', '')}".strip(),
            "postalCode": tags.get("addr:postcode", ""),
            "city": tags.get("addr:city", ""),
        }

    contact = {k: tags[k] for k in ("phone", "email", "website") if k in tags}
    out = {
        "id": slugify(tags["name"]), "name": tags["name"], "city": city_id,
        "osm": key, "address": address,
        "location": {"lat": round(pos[0], 6), "lon": round(pos[1], 6), "provenance": prov},
        "contact": contact, "cuisines": cuisines,
        "ratings": [], "menus": [],
        "open": ["Keine Speisekarte erfasst, Stammdaten aus OpenStreetMap"],
    }
    if hours := tags.get("opening_hours"):
        out["openingHours"] = {"raw": hours, "osm": hours, "provenance": dict(prov)}
    if menu_url := tags.get("website:menu"):
        out["open"].append(f"Karte laut OSM unter {menu_url}")
    return out


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "moosburg"))
