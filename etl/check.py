"""Prueft die Daten gegen sich selbst. Ohne Abhaengigkeiten, Exit 1 bei Fund.

Die Regel, die dieses Repo zusammenhaelt, ist die Herkunft: jede Angabe, die
veralten kann, traegt Quelle und Abrufdatum. Das laesst sich nur pruefen, nicht
erzwingen, deshalb dieses Skript.

    python etl/check.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

findings: list[str] = []


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def check_provenance(where: str, p: dict | None) -> None:
    if not p:
        findings.append(f"{where}: keine Herkunft")
        return
    if not p.get("retrievedAt"):
        findings.append(f"{where}: Herkunft ohne Abrufdatum")
    if not (p.get("url") or p.get("file")):
        findings.append(f"{where}: Herkunft nennt weder Quell-URL noch Datei")
    if (f := p.get("file")) and not (ROOT / f).exists():
        findings.append(f"{where}: hinterlegte Quelldatei fehlt: {f}")


def main() -> int:
    vocab = load(DATA / "vocab/allergens.json")
    allergens = set(vocab["allergene"])
    additives = set(vocab["zusatzstoffe"])
    cuisines = set(load(DATA / "vocab/cuisines.json")["kuechen"])
    kinds = set(load(DATA / "vocab/kinds.json")["arten"])

    for city_dir in sorted(p for p in DATA.iterdir() if p.is_dir() and p.name != "vocab"):
        restaurants = {}
        for path in sorted((city_dir / "restaurants").glob("*.json")):
            r = load(path)
            restaurants[r["id"]] = r
            where = f"{r['id']}"
            if r["id"] != path.stem:
                findings.append(f"{where}: id passt nicht zum Dateinamen {path.name}")
            for c in r["cuisines"]:
                if c not in cuisines:
                    findings.append(f"{where}: Kueche '{c}' fehlt im Vokabular")
            for k in r.get("kinds", []):
                if k not in kinds:
                    findings.append(f"{where}: Art '{k}' fehlt im Vokabular")
            if not r.get("kinds"):
                findings.append(f"{where}: keine Art des Hauses")
            if outline := r.get("outline"):
                check_provenance(f"{where}/Umriss", outline.get("provenance"))
                for ring in outline["rings"]:
                    if len(ring) < 4:
                        findings.append(f"{where}: Umriss mit nur {len(ring)} Punkten")
            for order in r.get("ordering", []):
                check_provenance(f"{where}/Bestellung", order.get("provenance"))
            if hours := r.get("openingHours"):
                check_provenance(f"{where}/Oeffnungszeiten", hours.get("provenance"))
            for rating in r.get("ratings", []):
                check_provenance(f"{where}/Bewertung {rating.get('source')}", rating.get("provenance"))
            for name in r["menus"]:
                if not (city_dir / "menus" / name).exists():
                    findings.append(f"{where}: verweist auf fehlende Karte {name}")

        for path in sorted((city_dir / "menus").glob("*.json")):
            menu = load(path)
            where = path.name
            check_provenance(where, menu.get("provenance"))
            rid = menu["restaurantId"]
            if rid not in restaurants:
                findings.append(f"{where}: unbekanntes Restaurant '{rid}'")
            elif path.name not in restaurants[rid]["menus"]:
                findings.append(f"{where}: {rid} fuehrt diese Karte nicht in 'menus'")

            for slug in menu["legend"]["allergens"].values():
                if slug not in allergens:
                    findings.append(f"{where}: Allergen '{slug}' fehlt im Vokabular")
            for slug in menu["legend"]["additives"].values():
                if slug not in additives:
                    findings.append(f"{where}: Zusatzstoff '{slug}' fehlt im Vokabular")

            items = [i for s in menu["sections"] for i in s["items"]]
            unknown = sum(len(i.get("markersUnknown", [])) for i in items)
            print(f"  {where:38} {len(items):4} Gerichte"
                  + (f", {unknown} nicht deutbare Marker" if unknown else ""))

    if findings:
        print("\nGefunden:")
        for f in findings:
            print(f"  ! {f}")
        return 1
    print("\nKeine Beanstandung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
