"""Die Daten einer Stadt für die App bündeln.

49 einzelne Restaurantdateien sind gut zu pflegen und schlecht zu laden.
Dieses Skript legt daraus zwei Dateien unter `public/data/<stadt>/` ab:

- `restaurants.json` startet die Karte. Klein genug, um sofort da zu sein.
- `dishes.json` ist die Gerichtsuche und wird erst geholt, wenn jemand danach
  sucht. Die Karte funktioniert ohne sie.

Die Herkunft reist mit. Sie ist der Grund für dieses Projekt und darf nicht
beim Bündeln verloren gehen, sonst steht in der App eine Zahl ohne Alter.

    python etl/bundle.py moosburg
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from common import ROOT


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, data) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def main(city_id: str) -> int:
    src = ROOT / "data" / city_id
    out = ROOT / "public" / "data" / city_id
    vocab_dir = ROOT / "data" / "vocab"

    city = load(src / "city.json")
    allergens = load(vocab_dir / "allergens.json")
    cuisines = load(vocab_dir / "cuisines.json")["kuechen"]

    menus = {p.name: load(p) for p in sorted((src / "menus").glob("*.json"))}
    by_restaurant: dict[str, list[dict]] = {}
    for name, menu in menus.items():
        by_restaurant.setdefault(menu["restaurantId"], []).append(menu)

    restaurants, dishes = [], []
    for path in sorted((src / "restaurants").glob("*.json")):
        r = load(path)
        own = by_restaurant.get(r["id"], [])
        count = sum(len(s["items"]) for m in own for s in m["sections"])

        entry = {k: r[k] for k in ("id", "name", "cuisines") if k in r}
        entry["dishCount"] = count
        for key in ("address", "location", "contact", "openingHours", "osm"):
            if r.get(key):
                entry[key] = r[key]
        if r.get("ratings"):
            entry["ratings"] = r["ratings"]
        # Woher die Karte stammt und wie alt sie ist. Ohne das stünde in der
        # App ein Preis ohne Datum, und genau das soll hier nicht passieren.
        if own:
            entry["menuProvenance"] = [m["provenance"] for m in own]
        restaurants.append(entry)

        for menu in own:
            for section in menu["sections"]:
                for item in section["items"]:
                    dishes.append({**item, "restaurantId": r["id"], "section": section["title"]})

    n1 = write(out / "restaurants.json",
               {"city": city, "cuisines": cuisines, "restaurants": restaurants})
    n2 = write(out / "dishes.json",
               {"allergens": allergens["allergene"], "additives": allergens["zusatzstoffe"],
                "dishes": dishes})

    with_menu = sum(1 for r in restaurants if r["dishCount"])
    print(f"  restaurants.json  {len(restaurants):4} Häuser, davon {with_menu} mit Karte"
          f"   {n1 / 1024:6.1f} kB")
    print(f"  dishes.json       {len(dishes):4} Gerichte"
          f"                    {n2 / 1024:6.1f} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "moosburg"))
