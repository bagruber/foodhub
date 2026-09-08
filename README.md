# foodhub

Speisekarten der Restaurants einer Stadt einlesen, die Gerichte in eine
gemeinsame Datenbank bringen und über eine Karte mit Filtern durchsuchbar
machen. Erste Anwendung: Moosburg an der Isar.

Jede Angabe trägt Quelle und Abrufdatum mit, und wo das Quelldokument eines
führt, auch sein Erstelldatum. Eine Speisekarte sagt von sich aus nicht, ob sie
noch gilt.

**Stand:** 49 Häuser in Moosburg auf der Karte, davon 16 mit eingelesener
Speisekarte, zusammen 1714 Gerichte aus 17 Karten.

Läuft unter [moosburg.eu/data/foodhub](https://moosburg.eu/data/foodhub/) und
[bagruber.github.io/foodhub](https://bagruber.github.io/foodhub/).

## Stack

Rein statisch, ohne Server, ohne Cookies, ohne Tracking.

**Oberfläche**

- [Vite](https://vite.dev) 8, [React](https://react.dev) 19,
  [TypeScript](https://www.typescriptlang.org) 7
- [Tailwind CSS](https://tailwindcss.com) v4 über `@tailwindcss/vite`,
  Grund-Tokens aus [moosburg-design](https://github.com/bagruber/moosburg-design)
- [MapLibre GL JS](https://maplibre.org) 5 mit den Vektorkacheln von
  [basemap.de](https://basemap.de) / BKG
- [Vitest](https://vitest.dev) für Zusammenfassung, Öffnungszeiten und Filter

**Einlesen** (`etl/`, Python)

- [Poppler](https://poppler.freedesktop.org) für `pdftotext -bbox-layout`:
  Wörter mit Position statt Fließtext, siehe `etl/pdftext.py`
- [pypdf](https://pypdf.readthedocs.io) für die Metadaten der PDF-Dateien
- sonst nur die Standardbibliothek. Overpass und Restaurant Guru werden mit
  `urllib` abgefragt, ein Paket dafür wäre mehr Abhängigkeit als Nutzen.

**Ausliefern**

GitHub Actions baut zweimal: nach GitHub Pages und per FTP nach
`moosburg.eu/data/foodhub/`. Die beiden unterscheiden sich nur im Basispfad.

## App

```bash
pnpm install
pnpm dev        # http://localhost:5173/foodhub/
pnpm test
```

## Einlesen

Braucht Python und `pypdf`, dazu `pdftotext` und `pdfimages` **aus Poppler**
(unter Windows `winget install oschwartz10612.Poppler`). Das gleichnamige
Programm aus Xpdf genügt nicht, ihm fehlt `-bbox-layout`.

```bash
for f in etl/menu_*.py; do python "$f"; done
python etl/check.py
python etl/bundle.py moosburg
```

`check.py` prüft die Daten gegen sich selbst: Verweise zwischen Restaurants und
Karten, Slugs gegen das Vokabular, und ob jede Herkunftsangabe ein Abrufdatum
und eine Quelle nennt. Exit 1 bei Fund.

Dazu, seltener gebraucht:

| | |
|---|---|
| `etl/osm.py moosburg` | Stammdaten über Overpass, `--aus-abzug` liest den letzten Abzug |
| `etl/reviews.py moosburg` | Bewertungslinks von Restaurant Guru und Google Maps |
| `etl/moosburgcard.py` | Akzeptanzstellen der MoosburgCard |
| `etl/gaenge.py` | zeigt, welche Kartenabschnitte keinem Gang zugeordnet sind |

## Weiter

Projektkontext in [KONTEXT.md](KONTEXT.md), Offenes in
[OFFENE-PUNKTE.md](OFFENE-PUNKTE.md), das Datenmodell in
[schema/types.ts](schema/types.ts). Die Vokabulare — Allergene, Küchen,
Zahlungsarten, Gänge, gleiche Produkte unter verschiedenen Namen — liegen in
[data/vocab/](data/vocab/) und erklären sich in der jeweiligen Datei selbst.
