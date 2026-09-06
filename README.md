# foodhub

Speisekarten der Restaurants einer Stadt einlesen, die Gerichte in eine
gemeinsame Datenbank bringen und über eine Karte mit Filtern durchsuchbar
machen. Erste Anwendung: Moosburg an der Isar.

Jede Angabe trägt Quelle und Abrufdatum mit, und wo das Quelldokument eines
führt, auch sein Erstelldatum. Eine Speisekarte sagt von sich aus nicht, ob sie
noch gilt.

**Stand:** 49 Häuser in Moosburg auf der Karte, davon 10 mit eingelesener
Speisekarte, zusammen 1146 Gerichte aus elf Karten.

Der Projektkontext steht in [KONTEXT.md](KONTEXT.md), was aussteht in
[OFFENE-PUNKTE.md](OFFENE-PUNKTE.md), das Datenmodell in
[schema/types.ts](schema/types.ts).

Läuft unter
[bagruber.github.io/foodhub](https://bagruber.github.io/foodhub/).

## App

```bash
pnpm install
pnpm dev        # http://localhost:5173/foodhub/
```

## Einlesen

Braucht Python und `pypdf`, dazu `pdftotext` und `pdfimages` **aus Poppler**
(unter Windows `winget install oschwartz10612.Poppler`). Das gleichnamige
Programm aus Xpdf genügt nicht, ihm fehlt `-bbox-layout`.

```bash
for f in etl/menu_*.py; do python "$f"; done
python etl/check.py
```

`check.py` prüft die Daten gegen sich selbst: Verweise zwischen Restaurants und
Karten, Slugs gegen das Vokabular, und ob jede Herkunftsangabe ein Abrufdatum
und eine Quelle nennt. Exit 1 bei Fund.

`python etl/osm.py moosburg` holt Koordinaten und Stammdaten über Overpass,
`python etl/bundle.py moosburg` bündelt alles für den Browser.
