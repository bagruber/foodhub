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

# Die Portale, deren Bewertungen wir weitergeben. Siehe etl/reviews.py, dort
# steht, warum es nicht mehr sind.
REVIEW_SOURCES = {"google_maps", "tripadvisor", "restaurantguru"}


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
    payments = set(load(DATA / "vocab/zahlung.json")["zahlungsarten"])

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
            for review in r.get("reviews", []):
                src = review.get("source")
                check_provenance(f"{where}/Bewertung {src}", review.get("provenance"))
                if src not in REVIEW_SOURCES:
                    findings.append(f"{where}: unbekannte Bewertungsquelle '{src}'")
                if not review.get("url"):
                    findings.append(f"{where}: Bewertung {src} ohne Link")
                # Eine Note ohne Skala ist nicht einzuordnen: 4 von 5 ist etwas
                # anderes als 4 von 10.
                if (rating := review.get("rating")) and not rating.get("scale"):
                    findings.append(f"{where}: Bewertung {src} ohne Skala")
            for slug, claim in (r.get("payment") or {}).items():
                if slug not in payments:
                    findings.append(f"{where}: Zahlungsart '{slug}' fehlt im Vokabular")
                if not isinstance(claim.get("accepted"), bool):
                    findings.append(f"{where}: Zahlungsart '{slug}' ohne klares Ja oder Nein")
                check_provenance(f"{where}/Zahlung {slug}", claim.get("provenance"))
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
