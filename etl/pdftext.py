"""Woerter mit Position aus einem PDF lesen.

Warum ueber die Position und nicht ueber den blossen Text: auf Speisekarten
kleben die Allergenmarker als hochgestellte Zeichen am Wort. `pdftotext`
liefert dann `Paneer 2Pakora`, und keine Regel trennt das zuverlaessig vom
Gerichtsnamen.

Poppler gibt je Wort die Font-Box, nicht die Glyphen-Box: `Paneer` und
`Pakora` messen beide 17,59 pt, obwohl nur eines eine Unterlaenge hat. Die
Boxhoehe entspricht also der Schriftgroesse, und das macht sie brauchbar.
Gemessen auf der indischen Karte: Gerichtsname 17,6 pt, Nummer und Preis
10,8 pt, Beschreibung 9,9 pt, hochgestellter Marker 5,8 bis 8,5 pt.

Hoehe allein genuegt trotzdem nicht, sonst geriete die kleiner gesetzte
Gerichtsnummer unter die Marker. Dazu kommt die Grundlinie: das hochgestellte
`2` sitzt 7,8 pt ueber der Grundlinie seines Bezugsworts, die Nummer nur
2,4 pt. Und weil beides Schaetzwerte an Schwellen sind, muss ein Marker
zusaetzlich wie einer aussehen, siehe `MARKER_SHAPE`.

Gebraucht wird `pdftotext` aus Poppler. Das gleichnamige Programm aus Xpdf
kennt `-bbox-layout` nicht und liegt auf manchen Rechnern frueher im PATH,
deshalb wird gezielt gesucht statt einfach aufgerufen.
"""

from __future__ import annotations

import os
import re
import statistics
import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Sequence

NS = "{http://www.w3.org/1999/xhtml}"

# Satzligaturen kommen als ein Zeichen aus dem PDF: der Staudinger Keller
# liefert `Ofenkartoﬀel` und `Kalbsﬂeischpﬂanzal`. Wer danach sucht oder zwei
# Karten vergleicht, findet sie sonst nie.
LIGATURES = str.maketrans({
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl",
    "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
})

# Anteil der Schrifthoehe, um den die Grundlinie steigen muss, damit ein Wort
# als hochgestellt gilt. Gemessen: Marker 7,8 pt bei 17,6 pt Schrift, also
# 44 Prozent; die kleiner gesetzte Gerichtsnummer kommt auf 13 Prozent.
SUPERSCRIPT_RISE = 0.25

# Wie ein Marker aussehen darf: Ziffern, Buchstaben, Kommas, hoechstens sechs
# Zeichen. `1,4agi` passt, `Pasteten` nicht. Das Sicherheitsnetz unter der
# Geometrie: kippt eine Schwelle, geht hoechstens ein Marker verloren, statt
# dass ein halber Beschreibungstext in den Allergenen landet.
MARKER_SHAPE = re.compile(r"[0-9A-Za-z,]{1,6}")


@lru_cache(maxsize=None)
def poppler(tool: str) -> str:
    """Pfad zu einem Poppler-Programm. Xpdf-Namensvettern werden uebergangen."""
    exe = tool + (".exe" if os.name == "nt" else "")
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        candidate = Path(entry) / exe
        if not candidate.is_file():
            continue
        proc = subprocess.run([str(candidate), "-v"], capture_output=True, text=True)
        if "poppler" in (proc.stdout + proc.stderr).lower():
            return str(candidate)
    raise RuntimeError(
        f"{tool} aus Poppler nicht gefunden. Unter Windows: "
        "winget install oschwartz10612.Poppler"
    )


@dataclass
class Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    page: int

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    @property
    def middle(self) -> float:
        return (self.y0 + self.y1) / 2


def words(pdf: Path, first: int | None = None, last: int | None = None) -> list[Word]:
    cmd = [poppler("pdftotext"), "-bbox-layout", "-enc", "UTF-8"]
    if first is not None:
        cmd += ["-f", str(first)]
    if last is not None:
        cmd += ["-l", str(last)]
    cmd += [str(pdf), "-"]
    xml = subprocess.run(cmd, capture_output=True, check=True).stdout.decode("utf-8")

    offset = (first or 1) - 1
    out: list[Word] = []
    for page_no, page in enumerate(ET.fromstring(xml).iter(NS + "page"), 1):
        for w in page.iter(NS + "word"):
            text = (w.text or "").strip().translate(LIGATURES)
            if text:
                out.append(Word(
                    text=text,
                    x0=float(w.get("xMin")), y0=float(w.get("yMin")),
                    x1=float(w.get("xMax")), y1=float(w.get("yMax")),
                    page=page_no + offset,
                ))
    return out


@dataclass
class Row:
    """Woerter, die auf derselben Zeile stehen, von links nach rechts."""

    words: list[Word]

    @property
    def page(self) -> int:
        return self.words[0].page

    @property
    def x0(self) -> float:
        return min(w.x0 for w in self.words)

    @property
    def x1(self) -> float:
        return max(w.x1 for w in self.words)

    @property
    def top(self) -> float:
        return min(w.y0 for w in self.words)

    @property
    def middle(self) -> float:
        """Senkrechte Mitte der Zeile, gemittelt ueber ihre Woerter."""
        return sum(w.middle for w in self.words) / len(self.words)

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)

    def split_markers(self) -> tuple[str, list[str]]:
        """Trennt die Zeile in Flieszschrift und hochgestellte Marker."""
        body, markers = [], []
        for w in self.words:
            (markers.extend(split_marker_text(w.text)) if is_superscript(w, self.words)
             else body.append(w.text))
        return " ".join(body), markers


def is_superscript(word: Word, context: list[Word]) -> bool:
    ref = max(context, key=lambda w: w.height)
    if word is ref or word.height >= ref.height:
        return False
    if not MARKER_SHAPE.fullmatch(word.text):
        return False
    return word.y1 < ref.y1 - SUPERSCRIPT_RISE * ref.height


def split_marker_text(raw: str) -> list[str]:
    """`1,4agi` wird zu `['1', '4', 'a', 'g', 'i']`."""
    return re.findall(r"\d+|[A-Za-z]", raw)


# Wie weit der Mittelpunkt eines Worts vom Anker abweichen darf, als Anteil
# der Ankerhoehe. Gemessen: innerhalb einer Zeile bis 20 Prozent, zur naechsten
# Zeile mindestens 100 Prozent.
ROW_SPREAD = 0.45

# Ab welchem Vielfachen der ueblichen Schrifthoehe ein Wort nicht mehr Text
# ist, sondern Zierrat. Auf der Karte der Drei Tannen steht ein geschwungenes
# `Servus` mit 287,6 pt quer ueber der Bierseite, das Zwanzigfache der
# ueblichen 14,1 pt. Ueber `ROW_SPREAD` setzte es die Zeilentoleranz auf
# 129 pt und zog damit eine halbe Seite in eine einzige Zeile: aus den Bieren
# wurde `Radler Radler Russ Cola Tannen Saisonales 0,33l _ Weiszbier 4,70`.
#
# Solche Woerter bilden deshalb je eine eigene Zeile. Weggeworfen werden sie
# nicht, denn der Parser soll selbst entscheiden, was Zierrat ist. Der Abstand
# ist gross: im ganzen Bestand ist dieses eine Wort betroffen, das
# naechstgroesste Verhaeltnis liegt bei 2,4.
OVERSIZED = 6.0


def columns(ws: list[Word], divider: float | Sequence[float] | None) -> list[list[Word]]:
    """Woerter an einer oder mehreren senkrechten Achsen in Spalten teilen."""
    if divider is None:
        return [ws]
    bounds = [divider] if isinstance(divider, (int, float)) else sorted(divider)
    groups: list[list[Word]] = [[] for _ in range(len(bounds) + 1)]
    for w in ws:
        index = sum(1 for b in bounds if w.x0 >= b)
        groups[index].append(w)
    return [g for g in groups if g]


def rows(ws: list[Word], divider: float | Sequence[float] | None = None) -> list[Row]:
    """Woerter zu Zeilen buendeln, seitenweise und von oben nach unten.

Gebuendelt wird ueber den senkrechten Mittelpunkt der Wortbox. Der wandert
    zwischen verschieden grossen Schriften einer Zeile kaum: auf der indischen
    Karte liegen Gerichtsname, Nummer, Preis und hochgestellter Marker in einer
    Spanne von 3,6 pt, waehrend die naechste Zeile 21 pt tiefer beginnt. Nach
    Grundlinie sortiert fiele der Marker in eine eigene Zeile, nach oberer
    Kante die kleiner gesetzte Nummer.

    Der Anker waechst bewusst nicht mit. Gegen die wachsende Ausdehnung der
    ganzen Gruppe geprueft, haengt sich Zeile an Zeile, solange sich je zwei
    benachbarte knapp beruehren, und am Ende ist eine halbe Seite eine Zeile.

    `divider` teilt mehrspaltige Karten vor der Buendelung an einer oder
    mehreren senkrechten Achsen. Ohne diese Trennung ziehen zwei nur leicht
    versetzte Zeilen zweier Spalten einander in eine gemeinsame Zeile, und der
    Text steht verschraenkt. Zeilen, die die Achse selbst ueberspannen, etwa
    Ueberschriften, entstehen dabei zweimal; wer den Divider setzt, muss sie
    im Parser wieder zusammenfuehren oder verwerfen.
    """
    limit = OVERSIZED * statistics.median([w.height for w in ws]) if ws else 0.0
    out: list[Row] = []
    for page in sorted({w.page for w in ws}):
        page_words = [w for w in ws if w.page == page]
        huge = [w for w in page_words if w.height > limit]
        groups = columns([w for w in page_words if w.height <= limit], divider)
        groups += [[w] for w in huge]
        page_rows: list[Row] = []
        for group in groups:
            current: list[Word] = []
            anchor = 0.0
            spread = 0.0
            for w in sorted(group, key=lambda w: (w.middle, w.x0)):
                if current and abs(w.middle - anchor) <= spread:
                    current.append(w)
                    # Die Toleranz richtet sich nach der groessten Schrift der
                    # Zeile, nicht nach dem Anker. Sonst zieht ein
                    # hochgestellter Marker, der als kleinstes Wort die Gruppe
                    # eroeffnet, den Rahmen so eng, dass Nummer und Preis
                    # herausfallen.
                    spread = max(spread, w.height * ROW_SPREAD)
                else:
                    if current:
                        page_rows.append(Row(sorted(current, key=lambda x: x.x0)))
                    current, anchor, spread = [w], w.middle, w.height * ROW_SPREAD
            if current:
                page_rows.append(Row(sorted(current, key=lambda x: x.x0)))
        out.extend(sorted(page_rows, key=lambda r: (r.top, r.x0)))
    return out


# Eine Zeile, die nur aus Zahlen, Mengenangaben und Waehrungszeichen besteht.
NUMERIC_ONLY = re.compile(r"^[\d,.\s€_lL]+$")


def merge_numeric_tails(rs: list[Row], divider: float, tolerance: float = 3.0) -> list[Row]:
    """Preisspalten wieder an ihre Zeile heften.

    Getraenkeseiten sind Tabellen: Name links, Preise rechts, eine Zeile. Der
    Spaltenteiler zerschneidet sie, und `Tafelwasser` steht dann getrennt von
    `2,60 3,70`. Speiseseiten sind dagegen echt zweispaltig, dort steht rechts
    ein eigenes Gericht.

    Unterschieden wird daran, ob die rechte Zeile ueberhaupt Text enthaelt.
    Nur Zahlen und Mengenangaben sind nie ein eigener Eintrag, sondern immer
    die Preisspalte der Zeile links davon.

    Verglichen wird die senkrechte Mitte, nicht die Oberkante. Preise stehen
    kleiner gesetzt als der Name, ihre Oberkante liegt deshalb systematisch
    tiefer: bei `Natur-Radler Blutorange alkoholfrei _ 0,33l _ 4,30` um 3,2 pt,
    knapp ueber der Toleranz, und das Getraenk hiesz danach `0,33l`. Nach
    Mitte gemessen sind es 1,6 pt.
    """
    out: list[Row] = []
    for row in rs:
        if (out and row.x0 >= divider
                and NUMERIC_ONLY.fullmatch(row.text)
                # Zwei Preisspalten nebeneinander gehoeren zu zwei
                # verschiedenen Getraenken, nicht zueinander: auf der
                # Saftseite stehen `0,5l _ 5,60` und `0,5l _ 4,70` auf einer
                # Hoehe, das eine zum Saft, das andere zur Schorle.
                and not NUMERIC_ONLY.fullmatch(out[-1].text)
                and out[-1].x0 < divider
                and out[-1].page == row.page
                and abs(out[-1].middle - row.middle) <= tolerance):
            out[-1] = Row(out[-1].words + row.words)
        else:
            out.append(row)
    return out
