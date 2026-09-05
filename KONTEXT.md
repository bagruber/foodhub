# foodhub, Projektkontext

*Lebendes Arbeitsdokument. Vollständig lesen, bevor Code geschrieben wird.
Änderungen mit Datum vermerken. Stand: 05.09.2026*

---

## 0. Arbeitsweise

Die allgemeinen Prinzipien gelten projektübergreifend und stehen nicht hier.
Was nur hier gilt:

- Sprache: UI-Texte und Doku deutsch, Code-Bezeichner englisch.
- Kein Tracking, keine Cookies, kein `localStorage`/`sessionStorage`.
- Keine Erwähnung von KI-Werkzeugen, nirgendwo.

---

## 1. Projektziel

Speisekarten der Restaurants einer Stadt einlesen, die Gerichte in eine
gemeinsame Datenbank bringen und sie über eine Karte mit Filtern durchsuchbar
machen. Ein anderer Weg, Essen in der eigenen Stadt zu finden: nicht Restaurant
für Restaurant, sondern über das Gericht und seine Eigenschaften.

Moosburg ist die erste Anwendung, eingepasst in das Ökosystem um moosburg.eu.
Das Repo bleibt auf andere Städte übertragbar: alles Ortsgebundene liegt unter
`data/<stadt>/`, alles andere ist stadtneutral.

---

## 2. Die Regel, die alles zusammenhält

**Jede Angabe, die veralten kann, trägt ihre Herkunft mit.** Quelle und
Abrufdatum, und wo das Quelldokument ein Erstelldatum in seinen Metadaten
führt, auch das. Das ist keine Formalie, sondern der Kern: eine Speisekarte
sagt nichts darüber, ob sie noch gilt.

Wie sichtbar das wird, zeigt der Bestand. Die Karte von Asia Rose wurde am
04.09.2026 abgerufen und trägt im PDF das Erstelldatum 28.04.2022. Ohne das
zweite Datum sähen die Preise aus wie von letzter Woche.

Getragen wird das vom Typ `Provenance` in [schema/types.ts](schema/types.ts).
Er hängt an der Speisekarte als Ganzes, an den Öffnungszeiten, an den
Koordinaten und an jeder einzelnen Bewertung, weil diese Angaben regelmäßig aus
verschiedenen Quellen stammen. `etl/check.py` prüft, dass keine davon fehlt.

---

## 3. Datenlage

### Die Karten aus Moosburg

| Restaurant | Kartenstand | Textlayer | Stand |
|---|---|---|---|
| Maharaja, indisch | 06.02.2026 | ja | 149 Gerichte eingelesen |
| Gasthof Drei Tannen, bayerisch | 30.08.2026 | ja | 139 Gerichte eingelesen |
| AN Asia Cuisine & Sushi | 13.05.2026 | **nein**, 20 Seiten je ein Bild | 157 Gerichte, außerhalb ausgelesen |
| Asia Rose, vietnamesisch | 28.04.2022 | **nein**, Schrift in Kurven | offen |
| Staudinger Keller, bayerisch | 01.06.2026 | ja | offen |
| Westerberg-Stub'n, Speisen | 29.07.2026 | ja | offen |
| Westerberg-Stub'n, Getränke | 27.06.2026 | ja | offen |
| La Forchetta, italienisch | 23.09.2025 | ja | offen |

Zwei Karten haben keinen Textlayer. Das ist kein Randfall, sondern der
Normalfall bei Gastronomie-PDFs aus Canva und CorelDRAW, und es bestimmt, wie
weit das Einlesen automatisierbar ist.

### Jedes Haus zählt anders

Die Allergenkennzeichnung ist gesetzlich vorgeschrieben, ihre Notation nicht:

- **Maharaja**: Ziffern für Allergene, Buchstaben für Zusatzstoffe
- **Drei Tannen**: genau umgekehrt, Buchstaben A–N für Allergene
- **AN**: Buchstaben a–o für Allergene, ohne j, Zahlen 1–18 für Zusatzstoffe
- **Asia Rose**: a–n mit Unterstufen, h1 Mandeln, h2 Haselnüsse

Deshalb trägt jede Kartendatei ihre eigene `legend`, die von der gedruckten
Karte auf das gemeinsame Vokabular in `data/vocab/` abbildet. Ohne sie ist
`markersRaw` nicht deutbar. `markersRaw` bleibt trotzdem erhalten, damit sich
jede Zuordnung gegen die gedruckte Karte prüfen lässt.

### Deklariert oder geschlossen

`vegan`, `vegetarisch` und `scharf` stehen mal auf der Karte, mal nicht. Bei
Allergien und Ernährungsformen haftet eine geratene Angabe anders als eine
gedruckte, deshalb trägt jede dieser Eigenschaften ein `basis`-Feld mit
`declared` oder `inferred`. Fehlt ein Eintrag, ist er unbekannt, nicht verneint.

Ein Beispiel, warum die Unterscheidung nötig ist: Maharaja überschreibt einen
Abschnitt mit „Vegetarisch auf Wunsch auch VEGAN erhältlich". Daraus folgt
`vegetarian: declared` für die Gerichte darunter, aber ausdrücklich kein
`vegan`. Die Küche kann es vegan zubereiten, es ist es nicht.

---

## 4. Wie die Karten eingelesen werden

Gearbeitet wird auf **Wörtern mit Position**, nicht auf dem Text von
`pdftotext`. Der Grund steht ausführlich in [etl/pdftext.py](etl/pdftext.py):
Allergenmarker sind hochgestellt und kleben am Wort, `Paneer²Pakora` lässt sich
im Fließtext nicht vom Gerichtsnamen trennen, über die Schriftgröße dagegen
eindeutig.

Gebraucht wird das `pdftotext` **aus Poppler**. Das gleichnamige Programm aus
Xpdf kennt `-bbox-layout` nicht und liegt auf diesem Rechner früher im PATH,
deshalb sucht `pdftext.poppler()` gezielt danach statt es aufzurufen.

Jede Karte hat ein eigenes Skript, weil die Layouts zu verschieden sind, um
sinnvoll unter einen Parser zu passen. Was sie teilen, steht in
`etl/common.py`. Die Anker:

- **Maharaja**: durchgehende Gerichtsnummern 101 bis 412
- **Drei Tannen**: der Unterstrich vor dem Preis, `Name _ 17,90`

Beide Karten sind zweispaltig und brauchen einen `DIVIDER`, eine senkrechte
Achse, an der die Spalten vor der Zeilenbildung getrennt werden. Ohne ihn
ziehen zwei leicht versetzte Zeilen einander in eine gemeinsame und der Text
steht verschränkt. Der Preis dafür: Zeilen, die über beide Spalten laufen,
werden zerschnitten.

Drei Folgen davon sind gelöst, weil sie sonst ganze Abschnitte kosten:

- **Preisspalten** werden von `merge_numeric_tails` wieder angeheftet. Eine
  rechte Zeile, die nur aus Zahlen und Mengenangaben besteht, ist nie ein
  eigener Eintrag, sondern die Preisspalte der Zeile links. So wird aus
  `Tafelwasser` und `2,60 3,70` wieder eine Zeile.
- **Einspaltige Seiten** bekommen keinen Teiler. Die Weinkarte von Drei Tannen
  auf Seite 8 läuft über die volle Breite; mit Teiler zerfiel jeder zweite Wein
  und vier von zehn fehlten.
- **Zwei Abschnitte nebeneinander** gibt es auf Maharajas Getränkeseiten, links
  „Alkoholfreie Getränke", rechts „Flaschen". Deshalb werden Abschnitt und
  Mengenspalten dort je Spalte geführt, sonst stünde das Leitungswasser unter
  „Flaschen".

Getränke stehen in Preistabellen mit Mengenspalten, nicht in Fließsatz. Die
Kopfzeile `0,25l 0,5l` wird gelesen und die Beträge darunter der Reihe nach
zugeordnet, aber nur, wenn genau so viele Beträge dastehen wie Spalten
angekündigt sind. Vom Preis unterscheidet die Marker die Stellenzahl: ein Preis
hat immer zwei Nachkommastellen, `3,60`, ein Zusatzstoffmarker nie, `3,4,6,7`.

```bash
python etl/menu_maharaja.py      # liest das PDF, schreibt data/.../menus/
python etl/menu_drei_tannen.py
python etl/menu_an_asia.py       # räumt den außerhalb erzeugten Extrakt auf
python etl/check.py              # prüft alle Daten gegen sich selbst
```

Jeder Lauf endet mit einem kurzen Prüfbericht: Gerichte ohne Preis, nicht
deutbare Marker, nicht zugeordnete Zeilen. Diese Zahlen sind der Wächter. Wenn
eine neue Kartenversion kommt und eine davon springt, hat sich das Layout
bewegt und die Schwellen gehören nachgemessen.

---

## 5. Bewertungen (Recherchestand 04.09.2026, noch nichts angebunden)

Aggregierte Bewertungen sind Teil des Ziels, aber die Rechtslage passt nicht
ohne Weiteres zu einer statischen, cookiefreien Seite.

| Quelle | Lage |
|---|---|
| **Google Places** | Liefert Rating, Anzahl, Öffnungszeiten. Dauerhaft speichern darf man nur die `place_id`, Koordinaten 30 Tage. Ein datierter Snapshot im Repo wäre genau das, was die Terms ausschließen. Live aus dem Browser hieße sichtbarer API-Key, also bräuchte es einen serverseitigen Proxy. |
| **Tripadvisor** | Die Content API ist zum 31.08.2026 abgeschaltet. Nachfolger ist die self-serve Terra API, erste 1000 Aufrufe frei, danach pro Aufruf. Attribution mit Bubble-Rating und Datum ist Pflicht. |
| **Yelp** | Kein kostenloses Kontingent mehr, ab etwa 8 $ pro 1000 Aufrufen. Abdeckung in Kleinstädten dünn. |
| **werkenntdenbesten, Golocal** | Keine öffentliche API. Nur Scraping, und damit das rechtlich wackeligste Feld. |
| **OpenStreetMap über Overpass** | Keine Bewertungen, aber ohne Key, ohne Kosten und ohne Cookies: Koordinaten, Adresse, `opening_hours`, `cuisine`, `diet:vegan`, Website, Telefon. |

**Entschieden am 04.09.2026:** zurückgestellt. Das Schema hält mit `Rating` und
`Restaurant.ratings` den Platz frei, `ratings` bleibt vorerst leer. OSM ist der
naheliegende erste Anschluss, weil es Stammdaten liefert, ohne eine dieser
Fragen aufzuwerfen.

---

## 6. Technik

Wie die Geschwisterprojekte: Vite, React 19, TypeScript, Tailwind v4,
Versionen aus `hausbasis/baseline.json`, Design aus `moosburg-design`. Die
Karte ist MapLibre auf den amtlichen Vektorkacheln von basemap.de, wie in
`baumkarte`: kein Schlüssel, keine Cookies, kein Anbieter, der mitzählt.

Das ETL läuft in Python, wie in `baumkarte`, und kommt mit der Standardbibliothek
plus `pypdf` aus. Die Positionsdaten liefert Poppler.

Die App lädt zwei Dateien. `restaurants.json` mit 38 kB startet die Karte,
`dishes.json` mit 119 kB wird erst geholt, wenn jemand nach einem Gericht
sucht. Beide erzeugt `etl/bundle.py` nach `public/data/<stadt>/`. Sie liegen
mit im Repo, obwohl sie ableitbar sind: sonst bräuchte jeder Build Python.

```bash
pnpm install
pnpm dev              # http://localhost:5173/foodhub/
pnpm data             # public/data neu bündeln, nach jeder Datenänderung
pnpm build
```

### Zwei Adressen, zwei Builds

| | Adresse | Basispfad | Build |
|---|---|---|---|
| GitHub Pages | `bagruber.github.io/foodhub/` | `/foodhub/` | `pnpm build` |
| moosburg.eu | `moosburg.eu/data/foodhub/` | `/data/foodhub/` | `pnpm build:hostinger` |

Der zweite Pfad steht im Script-Eintrag als `--base`, nicht in
`vite.config.ts`. Eine Änderung an `base` in der Config bräche eine der beiden
Varianten. Das Muster ist aus `baumkarte` übernommen, dort steht der
Plattform-Kontext ausführlich in `PLATTFORM.md`.

---

## 7. Ordnung im Repo

```
data/
  vocab/            allergens.json, cuisines.json, stadtneutral
  moosburg/
    city.json       Mittelpunkt und Ausschnitt für die Karte
    restaurants/    ein Haus je Datei, Dateiname = id
    menus/          eine Kartenversion je Datei
sources/
  moosburg/         die PDFs, als belegte Quelle hinterlegt
etl/                Einlesen und Prüfen
schema/types.ts     das Datenmodell
```

Die PDFs heißen `<restaurant>_<art>_<erstelldatum>.pdf`, das Datum aus den
Metadaten des Dokuments, nicht aus dem Dateinamen, unter dem sie ankamen.
Kartendateien heißen `<restaurant>_<erstelldatum>.json`. Eine neue Karte wird
eine neue Datei, die alte bleibt liegen, damit sich Preisbewegungen später
zeigen lassen.
