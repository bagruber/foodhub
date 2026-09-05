"""Was sich die Kartenskripte teilen: Herkunft, Preise, Schaerfe, Ausgabe."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent

PRICE = re.compile(r"\b(\d{1,3}),(\d{2})\b")


def pdf_created(pdf: Path) -> str | None:
    """Erstelldatum aus den PDF-Metadaten, als `YYYY-MM-DD`.

    Sagt, wie alt die Karte selbst ist. Das ist etwas anderes als das
    Abrufdatum: die Karte von Asia Rose stammt von 2022, gefunden haben wir sie
    2026. Wer nur das Abrufdatum sieht, haelt vier Jahre alte Preise fuer
    aktuell.
    """
    raw = (PdfReader(pdf).metadata or {}).get("/CreationDate")
    m = re.match(r"D?:?(\d{4})(\d{2})(\d{2})", str(raw or ""))
    return f"{m[1]}-{m[2]}-{m[3]}" if m else None


def provenance(pdf: Path, url: str | None, retrieved: str, note: str | None = None) -> dict:
    out = {
        "kind": "pdf",
        "file": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        "retrievedAt": retrieved,
    }
    if url:
        out["url"] = url
    if created := pdf_created(pdf):
        out["createdAt"] = created
    if note:
        out["note"] = note
    return out


def prices(text: str) -> list[dict]:
    """Alle Betraege einer Zeile, in der Reihenfolge des Vorkommens.

    Nicht als Preis gewertet werden Mengenangaben wie `0,5l` oder `0,33l`, die
    auf Getraenkeseiten unmittelbar neben den Betraegen stehen.
    """
    out = []
    for m in PRICE.finditer(text):
        if text[m.end():m.end() + 1].lower() == "l":
            continue
        out.append({"amount": float(f"{m[1]}.{m[2]}"), "currency": "EUR"})
    return out


SPICE = [
    (re.compile(r"\bsehr scharf\b", re.I), 3),
    (re.compile(r"\bleicht (?:scharf|pikant)\b", re.I), 1),
    (re.compile(r"\b(?:scharf|pikant)\b", re.I), 2),
]


def spice(text: str) -> dict | None:
    """Schaerfe aus dem Wortlaut. `basis` ist `declared`, es steht auf der Karte."""
    for pattern, level in SPICE:
        if pattern.search(text):
            return {"level": level, "basis": "declared"}
    return None


@dataclass
class Item:
    name: str
    ref: str | None = None
    description: str = ""
    prices: list[dict] = field(default_factory=list)
    markersRaw: list[str] = field(default_factory=list)
    # Was am einzelnen Gericht ausgewiesen ist, etwa das Wort VEGAN oder ein
    # Chilisymbol. Geht dem vor, was aus dem Abschnitt oder dem Wortlaut folgt.
    diet: dict = field(default_factory=dict)
    spice: dict | None = None

    def to_json(self, legend: dict, diet: dict | None = None) -> dict:
        allergens, additives, unknown = [], [], []
        for raw in self.markersRaw:
            # Die Karten sind uneinheitlich: Maharaja druckt die Marker klein
            # und erklaert sie gross, AN schreibt beides klein. Deshalb beide
            # Schreibweisen nachschlagen statt eine zu erzwingen.
            if hit := lookup(legend["allergens"], raw):
                allergens.append(hit)
            elif hit := lookup(legend["additives"], raw):
                additives.append(hit)
            else:
                unknown.append(raw)
        out = {
            "name": self.name,
            "prices": self.prices,
            "markersRaw": self.markersRaw,
            "allergens": sorted(set(allergens)),
            "additives": sorted(set(additives)),
            "diet": {**(diet or {}), **self.diet},
        }
        if self.ref:
            out["ref"] = self.ref
        if self.description:
            out["description"] = self.description
        if s := self.spice or spice(f"{self.name} {self.description}"):
            out["spice"] = s
        if unknown:
            out["markersUnknown"] = unknown
        return out


def lookup(table: dict, raw: str) -> str | None:
    for key in (raw, raw.upper(), raw.lower()):
        if key in table:
            return table[key]
    return None


def write_menu(path: Path, menu: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(menu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def report(menu: dict) -> None:
    """Kurzer Pruefbericht auf der Konsole. Auffaelliges zuerst."""
    items = [i for s in menu["sections"] for i in s["items"]]
    print(f"  {len(menu['sections'])} Abschnitte, {len(items)} Gerichte")
    for label, hits in [
        ("ohne Preis", [i for i in items if not i["prices"]]),
        ("mehr als zwei Preise", [i for i in items if len(i["prices"]) > 2]),
        ("unbekannte Marker", [i for i in items if i.get("markersUnknown")]),
        ("ohne Beschreibung", [i for i in items if not i.get("description")]),
    ]:
        if hits:
            names = ", ".join(f"{i.get('ref', '?')} {i['name']}" for i in hits[:6])
            more = f" (+{len(hits) - 6})" if len(hits) > 6 else ""
            print(f"    {label}: {len(hits)} -> {names}{more}")


# Kopfzeile einer Getraenketabelle, etwa `0,3l 0,5l` oder `0,25l 0,5l`.
PORTION_HEADER = re.compile(r"(?:\d+,\d+\s*l\s*)+")
PORTION = re.compile(r"\d+,\d+\s*l")

# Marker am Ende des Namens: einzelne Ziffern mit Komma, `3,4,6,7`. Vom Preis
# unterscheidet sie die Stellenzahl. Ein Preis hat immer zwei Nachkommastellen,
# `3,60`, ein Marker nie. Deshalb greift `PRICE` in `Libella Cola Zero 3,4,6,7
# 3,60 4,70` genau die beiden Betraege und laesst die vier Marker stehen.
TRAILING_MARKERS = re.compile(r"\s(\d(?:,\d)*)\s*$")


def portion_header(text: str) -> list[str] | None:
    """Mengen einer Tabellenkopfzeile, sonst None."""
    if PORTION_HEADER.fullmatch(text.strip()):
        return [re.sub(r"\s+", "", m) for m in PORTION.findall(text)]
    return None


def table_row(text: str, portions: list[str]) -> Item | None:
    """Eine Zeile einer Getraenketabelle: `Tafelwasser 2,60 3,70`.

    Die Mengen kommen aus der Kopfzeile darueber. Zugeordnet werden sie nur,
    wenn genau so viele Betraege in der Zeile stehen wie Spalten angekuendigt
    sind. Steht die Menge schon im Namen, wie bei `Red Bull (0,25l) 4,50`,
    bleibt die Spalte offen statt falsch geraten.
    """
    found = list(PRICE.finditer(text))
    if not found:
        return None
    head = text[:found[0].start()].strip()
    if not any(c.isalpha() for c in head):
        return None

    markers: list[str] = []
    if m := TRAILING_MARKERS.search(head):
        markers = m[1].split(",")
        head = head[:m.start()].strip()

    amounts = prices(text)
    if len(amounts) == len(portions):
        for amount, portion in zip(amounts, portions):
            amount["portion"] = portion
    return Item(name=head, prices=amounts, markersRaw=markers)
