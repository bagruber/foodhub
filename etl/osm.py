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
    python etl/osm.py moosburg --aus-abzug   # ohne Overpass, aus der letzten Datei
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


def post(query: str) -> dict:
    request = urllib.request.Request(
        ENDPOINT, data=query.encode("utf-8"),
        headers={"User-Agent": "foodhub/0.1 (github.com/bagruber/foodhub)"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch(city: dict) -> dict:
    west, south, east, north = city["bbox"]
    return post(QUERY.format(amenities=AMENITIES, south=south, west=west,
                             north=north, east=east))


BUILDINGS = """[out:json][timeout:60];
node(id:{ids});
is_in->.a;
way(pivot.a)["building"];
out geom;
"""


def fetch_buildings(node_ids: list[str]) -> list[dict]:
    """Die Gebäude, in denen die Häuser liegen.

    `is_in` liefert die umschliessenden Flächen, aber nicht, welche zu welchem
    Knoten gehört. Die Zuordnung entsteht deshalb unten über
    `point_in_ring`. Von 49 Moosburger Häusern haben 42 ein Gebäude.
    """
    return post(BUILDINGS.format(ids=",".join(node_ids)))["elements"]


def point_in_ring(lon: float, lat: float, ring: list[dict]) -> bool:
    """Strahlverfahren: zählt, wie oft ein Strahl nach rechts die Kanten kreuzt.

    Ungerade heisst innen. Reicht hier, weil Gebäudeumrisse einfache, nicht
    überschlagene Polygone sind.
    """
    inside = False
    for i in range(len(ring)):
        a, b = ring[i - 1], ring[i]
        if (a["lat"] > lat) != (b["lat"] > lat):
            x = a["lon"] + (lat - a["lat"]) * (b["lon"] - a["lon"]) / (b["lat"] - a["lat"])
            if lon < x:
                inside = not inside
    return inside


def outline_for(lon: float, lat: float, buildings: list[dict], today: str) -> dict | None:
    """Das kleinste Gebäude, das den Punkt enthält.

    Das kleinste, weil ein Haus in einem Einkaufszentrum sonst dessen ganze
    Grundfläche bekäme, wenn beide gemappt sind.
    """
    hits = [b for b in buildings
            if b.get("geometry") and point_in_ring(lon, lat, b["geometry"])]
    if not hits:
        return None
    best = min(hits, key=lambda b: bbox_area(b["geometry"]))
    key = f"way/{best['id']}"
    return {
        "rings": [[[round(p["lon"], 6), round(p["lat"], 6)] for p in best["geometry"]]],
        "building": best.get("tags", {}).get("building"),
        "provenance": {
            "kind": "osm",
            "url": f"https://www.openstreetmap.org/{key}",
            "retrievedAt": today,
            "note": "© OpenStreetMap-Mitwirkende, ODbL. Umriss des Gebäudes, "
                    "nicht der Gasträume.",
        },
    }


def bbox_area(geometry: list[dict]) -> float:
    lons = [p["lon"] for p in geometry]
    lats = [p["lat"] for p in geometry]
    return (max(lons) - min(lons)) * (max(lats) - min(lats))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def coordinates(element: dict) -> tuple[float, float] | None:
    if "lat" in element:
        return element["lat"], element["lon"]
    if center := element.get("center"):
        return center["lat"], center["lon"]
    return None


def main(city_id: str, cached: bool = False) -> int:
    """`cached` liest den letzten Abzug statt Overpass neu zu fragen.

    Dafuer, dass sich die Zuordnungsregeln hier aendern, ohne dass sich in OSM
    etwas geaendert hat. Die oeffentliche Overpass-Instanz ist ein geteiltes,
    kostenloses Gut und antwortet unter Last mit 504; sie fuer einen
    Regeltest zu fragen waere unhoeflich. Umrisse bleiben dabei unberuehrt: sie
    braeuchten eine zweite Abfrage, und ohne sie wuerde jeder vorhandene Umriss
    geloescht.
    """
    city_dir = ROOT / "data" / city_id
    city = json.loads((city_dir / "city.json").read_text(encoding="utf-8"))
    today = date.today().isoformat()

    if cached:
        dumps = sorted((ROOT / "sources" / city_id).glob("osm_*.json"))
        if not dumps:
            raise SystemExit("kein gespeicherter Abzug vorhanden")
        dump = dumps[-1]
        raw = json.loads(dump.read_text(encoding="utf-8"))
        print(f"aus {dump.relative_to(ROOT)}, ohne Overpass zu fragen")
    else:
        raw = fetch(city)
        dump = ROOT / "sources" / city_id / f"osm_{today}.json"
        dump.parent.mkdir(parents=True, exist_ok=True)
        dump.write_text(json.dumps(raw, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    elements = [e for e in raw["elements"] if e.get("tags", {}).get("name")]
    print(f"{len(elements)} benannte Gaststätten in OSM, gesichert in {dump.relative_to(ROOT)}")

    if cached:
        buildings = []
    else:
        node_ids = [str(e["id"]) for e in elements if e["type"] == "node"]
        buildings = fetch_buildings(node_ids)
        print(f"{len(buildings)} Gebäudeumrisse dazu")

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
        if not cached:
            if outline := outline_for(pos[1], pos[0], buildings, today):
                r["outline"] = outline
            else:
                r.pop("outline", None)

        # Art des Hauses und Dienste kommen aus OSM, auch bei den von Hand
        # gepflegten Häusern. Die Küche nicht: die steht dort genauer, weil sie
        # aus der gelesenen Speisekarte stammt.
        if not r.get("kinds"):
            r["kinds"] = kinds_of(hit["tags"])
        # Was inzwischen die Art beschreibt, gehört nicht mehr zur Küche.
        moved = [ALIASES.get(c, c) for c in r.get("cuisines", [])
                 if ALIASES.get(c, c) in KIND_SLUGS]
        if moved:
            r["cuisines"] = [c for c in r["cuisines"]
                             if ALIASES.get(c, c) not in KIND_SLUGS]
            r["kinds"] = r["kinds"] + [c for c in moved if c not in r["kinds"]]
        if services := services_of(hit["tags"]):
            r["services"] = services
        if diet := diet_of(hit["tags"]):
            r["diet"] = diet
        # Zahlungsarten aus OSM ueberschreiben nur ihre eigenen Slugs. Die
        # MoosburgCard kommt aus einer anderen Quelle und bleibt stehen.
        if pay := payment_of(hit["tags"], r["location"]["provenance"]):
            r["payment"] = {**{k: v for k, v in (r.get("payment") or {}).items()
                               if k not in PAYMENT_TAGS.values() and k != "mobile"},
                            **pay}

        if offen := r.get("open"):
            r["open"] = [x for x in offen if x != "Koordinaten fehlen"]
            if not r["open"]:
                del r["open"]
        write_json(path, r)

        tags = hit["tags"]
        extra = [k for k in ("opening_hours", "phone", "website", "cuisine") if k in tags]
        print(f"  + {r['name']:26} {key:16} {pos[0]:.5f}, {pos[1]:.5f}  hat: {', '.join(extra) or '-'}")

    rest = [e for k, e in by_id.items() if k not in matched and k not in ABGELOEST]
    print()
    print(f"{len(rest)} weitere Gaststätten in OSM ohne eigenen Eintrag:")
    taken = {p.stem for p in (city_dir / "restaurants").glob("*.json")}
    added = 0
    for e in sorted(rest, key=lambda e: e["tags"]["name"]):
        entry = draft(e, city_id, today)
        if entry is not None and (pos := coordinates(e)):
            if outline := outline_for(pos[1], pos[0], buildings, today):
                entry["outline"] = outline
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


# Die Art des Hauses folgt aus `amenity`. Sie ist keine Küche und steht
# deshalb in einem eigenen Feld: der Staudinger Keller ist Wirtshaus und
# Biergarten, und ein Café kann bayerisch kochen.
FROM_AMENITY = {
    "restaurant": "restaurant", "cafe": "cafe", "bar": "bar", "pub": "pub",
    "biergarten": "biergarten", "fast_food": "fast_food",
    "ice_cream": "ice_cream",
}

# Küchen-Werte, die in Wahrheit die Art des Hauses beschreiben. OSM mischt das,
# `cuisine=ice_cream` steht an einer Eisdiele.
# In der alten gemischten Liste hiess der Biergarten anders als jetzt.
ALIASES = {"beer_garden": "biergarten"}

KIND_SLUGS = set(json.loads(
    (ROOT / "data/vocab/kinds.json").read_text(encoding="utf-8"))["arten"])

CUISINE_IS_KIND = {
    "ice_cream": "ice_cream", "coffee_shop": "coffee_shop", "bistro": "bistro",
}


def kinds_of(tags: dict) -> list[str]:
    out = []
    if kind := FROM_AMENITY.get(tags.get("amenity", "")):
        out.append(kind)
    # Ein Wirtshaus mit Biergarten ist beides. Genau dafür ist das Feld M:N.
    if tags.get("biergarten") == "yes" and "biergarten" not in out:
        out.append("biergarten")
    if tags.get("tourism") == "hotel":
        out.append("hotel")
    if tags.get("shop") == "bakery":
        out.append("bakery")
    for value in tags.get("cuisine", "").split(";"):
        if (kind := CUISINE_IS_KIND.get(value)) and kind not in out:
            out.append(kind)
    return out


def services_of(tags: dict) -> dict:
    out = {}
    for key, field in (("delivery", "delivery"), ("takeaway", "takeaway"),
                       ("outdoor_seating", "outdoorSeating")):
        if tags.get(key) in ("yes", "no"):
            out[field] = tags[key] == "yes"
    if tags.get("wheelchair") in ("yes", "limited", "no"):
        out["wheelchair"] = tags["wheelchair"]
    return out


# OSM-Tag zu Slug aus data/vocab/zahlung.json. `payment:cards` ist der
# Sammelbegriff und bleibt daneben stehen: ein Haus, das ihn setzt, sagt damit
# nicht, welche Karten, und das ist eine andere Auskunft als EC-Karte ja,
# Kreditkarte nein.
PAYMENT_TAGS = {
    "payment:cash": "cash",
    "payment:cards": "cards",
    "payment:debit_cards": "debit_cards",
    "payment:credit_cards": "credit_cards",
    "payment:contactless": "contactless",
    "payment:qr_code": "qr_code",
}
# Handy-Bezahldienste zaehlen zusammen: wer Apple Pay nimmt, nimmt praktisch
# immer auch Google Pay, und die App fragt nach dem Handy, nicht nach der Marke.
PAYMENT_MOBILE = ("payment:apple_pay", "payment:google_pay", "payment:mobile_payment")


def payment_of(tags: dict, prov: dict) -> dict:
    """Zahlungsarten mit Herkunft je Angabe.

    `no` wird uebernommen, nicht verschwiegen. Dass ein Wirtshaus ausdruecklich
    keine Kreditkarte nimmt, ist die nuetzlichere Auskunft von beiden: sie sagt
    jemandem, dass er Bargeld braucht. Ein fehlender Schluessel heisst dagegen,
    dass wir es nicht wissen.
    """
    out = {}
    for tag, slug in PAYMENT_TAGS.items():
        if tags.get(tag) in ("yes", "no"):
            out[slug] = {"accepted": tags[tag] == "yes", "provenance": dict(prov)}
    mobile = [tags[t] for t in PAYMENT_MOBILE if tags.get(t) in ("yes", "no")]
    if mobile:
        out["mobile"] = {"accepted": "yes" in mobile, "provenance": dict(prov)}
    return out


def diet_of(tags: dict) -> dict:
    """Ernährungsangebot des Hauses, nicht des einzelnen Gerichts.

    `only` heisst ausschliesslich, `yes` es gibt etwas, `no` nichts. OSM führt
    das für 27 der Moosburger Häuser, und es ist die einzige Angabe dieser Art
    für die 42 ohne eingelesene Speisekarte.
    """
    out = {}
    for tag, field in (("diet:vegetarian", "vegetarian"), ("diet:vegan", "vegan"),
                       ("diet:halal", "halal"), ("diet:kosher", "kosher"),
                       ("diet:gluten_free", "gluten_free")):
        if tags.get(tag) in ("only", "yes", "no"):
            out[field] = tags[tag]
    return out


def slugify(name: str) -> str:
    out = name.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"), ("´", ""), ("'", "")):
        out = out.replace(a, b)
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", out)).strip("-")


# Objekte, die in OSM noch unter dem Namen des Vorgängers stehen. Ohne diese
# Liste legte jeder Lauf den geschlossenen Betrieb wieder an, denn OSM meldet
# ihn weiter. Der Nachfolger steht mit eigener Datei daneben und bleibt
# bewusst ohne `osm`: die Öffnungszeiten und die Ernährungsangaben an diesem
# Knoten beschreiben den Vorgänger, nicht ihn.
#
# Das ist eine Krücke. Der eigentliche Ort für diese Korrektur ist OSM selbst.
ABGELOEST = {
    "node/7725213368": "Tattva, seit 2026 Amrutham (data/moosburg/restaurants/amrutham.json)",
}


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

    cuisines = [c for c in tags.get("cuisine", "").split(";") if c
                and c not in CUISINE_IS_KIND]

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
        "contact": contact, "kinds": kinds_of(tags), "cuisines": cuisines,
        "reviews": [], "menus": [],
        "open": ["Keine Speisekarte erfasst, Stammdaten aus OpenStreetMap"],
    }
    if services := services_of(tags):
        out["services"] = services
    if diet := diet_of(tags):
        out["diet"] = diet
    if pay := payment_of(tags, prov):
        out["payment"] = pay
    if hours := tags.get("opening_hours"):
        out["openingHours"] = {"raw": hours, "osm": hours, "provenance": dict(prov)}
    if menu_url := tags.get("website:menu"):
        out["open"].append(f"Karte laut OSM unter {menu_url}")
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(main(args[0] if args else "moosburg", "--aus-abzug" in sys.argv))
