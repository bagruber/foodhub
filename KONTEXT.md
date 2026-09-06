# foodhub, Projektkontext

*Lebendes Arbeitsdokument. Vollständig lesen, bevor Code geschrieben wird.
Änderungen mit Datum vermerken. Stand: 06.09.2026, abends*

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
| Amrutham, indisch | 06.09.2026 | ja | 210 Gerichte |
| AN Asia Cuisine & Sushi | 13.05.2026 | **nein**, 20 Seiten je ein Bild | 157 Gerichte, außerhalb ausgelesen |
| Maharaja, indisch | 06.02.2026 | ja | 149 Gerichte |
| Gasthof Drei Tannen, bayerisch | 30.08.2026 | ja | 143 Gerichte |
| Asia Rose, vietnamesisch | 28.04.2022 | **nein**, Schrift in Kurven | 131 Gerichte, außerhalb ausgelesen |
| Necmi's Pizza and More | 06.09.2026 | ja, Shopausdruck | 131 Gerichte |
| Café Woch'nblatt | 06.09.2026 | ja, Seitenausdruck | 129 Gerichte |
| Mythos im Moosburger Hof | 06.09.2026 | ja | 121 Gerichte |
| Staudinger Keller, bayerisch | 01.06.2026 | ja | 117 Gerichte |
| Alexander The Great, griechisch | 06.09.2026 | ja | 98 Gerichte |
| La Forchetta, italienisch | 23.09.2025 | ja | 78 Gerichte |
| Westerberg-Stub'n, Getränke | 27.06.2026 | ja | 78 Getränke |
| Balkan-Restaurant Avlija | 24.01.2024 | ja, über speisekarte.de | 43 Gerichte |
| Da Sophie e Massimo | 06.09.2026 | ja, Seitenausdruck | 38 Gerichte |
| Westerberg-Stub'n, Speisen | 29.07.2026 | ja | 31 Gerichte |
| Rosenhof-Lichtspiele | 07.08.2026 | ja | 19 Gerichte |

Zusammen 1673 Gerichte aus sechzehn Karten in fünfzehn Häusern, von 49
erfassten. Zwei Karten kommen aus einem Ausdruck der Bestellseite, eine über
ein fremdes Portal; das steht jeweils in der Herkunft, denn es ist ein
Unterschied, ob der Wirt eine Fassung veröffentlicht hat oder ein Dritter sie
erfasst hat.

Zwei Karten haben keinen Textlayer. Das ist kein Randfall, sondern der
Normalfall bei Gastronomie-PDFs aus Canva und CorelDRAW, und es bestimmt, wie
weit das Einlesen automatisierbar ist.

### Jedes Haus zählt anders

Die Allergenkennzeichnung ist gesetzlich vorgeschrieben, ihre Notation nicht:

- **Maharaja**: Ziffern für Allergene, Buchstaben für Zusatzstoffe
- **Drei Tannen**: genau umgekehrt, Buchstaben A–N für Allergene
- **AN**: Buchstaben a–o für Allergene, ohne j, Zahlen 1–18 für Zusatzstoffe
- **Asia Rose**: a–n mit Unterstufen, h1 Mandeln, h2 Haselnüsse
- **Alexander**: A–N für Allergene, aber nicht in der Reihenfolge der LMIV,
  und zwei Zeichen doppelt vergeben
- **Woch'nblatt und Rosenhof**: erklären nichts. Die Zeichenerklärung liegt
  auf einer eigenen Seite beziehungsweise einer separaten Allergikerkarte,
  beim Woch'nblatt hinter einem Pfad, den die `robots.txt` des Hauses sperrt.
  Die Marker bleiben als `markersRaw` stehen, gedeutet wird nichts. Das ist
  die Stelle, an der Raten am nächsten läge und am teuersten wäre: die
  Buchstaben sehen aus wie die übliche Reihe a bis n, sind es aber nicht. Auf
  `Kugel Eis` steht `(d)`, und in der Standardreihe wäre das Fisch.

Deshalb trägt jede Kartendatei ihre eigene `legend`, die von der gedruckten
Karte auf das gemeinsame Vokabular in `data/vocab/` abbildet. Ohne sie ist
`markersRaw` nicht deutbar. `markersRaw` bleibt trotzdem erhalten, damit sich
jede Zuordnung gegen die gedruckte Karte prüfen lässt.

### Zwei Achsen, nicht eine

Die Art des Hauses und die Küche sind unabhängig voneinander. Der Staudinger
Keller ist Wirtshaus **und** Biergarten, eine Bäckerei ist auch Café, und
nichts hindert ein Café daran, bayerisch zu kochen. In einer gemeinsamen Liste
stünde all das gleichrangig nebeneinander, und der Filter böte „Café" neben
„Bayerisch" an, als wäre das eine Wahl zwischen zweien.

Deshalb `kinds` aus `data/vocab/kinds.json` und `cuisines` aus
`cuisines.json`, beide M:N. OSM mischt das an einer Stelle selbst, dort steht
`cuisine=ice_cream` an einer Eisdiele; solche Werte wandern beim Einlesen
hinüber.

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
- **La Forchetta**: das Eurozeichen, `Name € 11,00`, dazu drei Spalten
- **Staudinger Keller**: Überschriften an ihren Unterstrichen, `_ Salate _`
- **Westerberg-Stub'n**: der rechtsbündige Preis am Zeilenende

Drei Karten sind mehrspaltig und brauchen einen `DIVIDER`, eine oder mehrere
senkrechte Achsen, an denen die Spalten vor der Zeilenbildung getrennt werden. Ohne ihn
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
- **Seiten mit wechselndem Layout** bekommen waagrechte Bänder. Seite 9 der
  Drei Tannen ist oben zweispaltig und ab den Aperitifen einspaltig; ein Teiler
  für die ganze Seite zerschnitt dort `Gin Tonic Bombay Sapphire 4cl / Thomas
  Henry 0,2l _ 8,90` und machte daraus das Getränk `0,2l`.

Zwei weitere Fallen liegen nicht in den Spalten, sondern im Satz:

- **Zierrat.** Ein Wort, das ein Vielfaches der üblichen Schrifthöhe misst, ist
  keine Schrift mehr. Auf der Bierseite der Drei Tannen steht ein
  geschwungenes `Servus` mit 287,6 pt quer über der Seite, das Zwanzigfache der
  üblichen 14,1 pt. Über die Zeilentoleranz zog es eine halbe Seite in eine
  einzige Zeile. Solche Wörter bilden deshalb je eine eigene Zeile.
- **Ligaturen und hochgestellte Zeichen.** `Ofenkartoﬀel` kommt als ein Zeichen
  aus dem PDF, `Cappuccino²` als ein Wort mit einem hochgestellten Zeichen
  darin. Beides lässt sich geometrisch nicht trennen, weil es keine zweite Box
  gibt; beides wird deshalb im Text normalisiert.

Getränke stehen in Preistabellen mit Mengenspalten, nicht in Fließsatz. Die
Kopfzeile `0,25l 0,5l` wird gelesen und die Beträge darunter der Reihe nach
zugeordnet, aber nur, wenn genau so viele Beträge dastehen wie Spalten
angekündigt sind. Vom Preis unterscheidet die Marker die Stellenzahl: ein Preis
hat immer zwei Nachkommastellen, `3,60`, ein Zusatzstoffmarker nie, `3,4,6,7`.

Zwei Karten liefern nicht alles im Text. Bei der Westerberg-Stub'n stehen die
handgeschriebenen Abschnittsüberschriften und das grüne Blatt für „vegetarisch"
als Grafik in der Seite. Beides ist im Parser von Hand eingetragen, abgelesen
von den gerenderten Seiten, und als solches gekennzeichnet: es ist die einzige
Stelle im Bestand mit gepflegten statt gelesenen Inhalten.

```bash
for f in etl/menu_*.py; do python "$f"; done
python etl/check.py              # prüft alle Daten gegen sich selbst
```

Jeder Lauf endet mit einem kurzen Prüfbericht: Gerichte ohne Preis, nicht
deutbare Marker, nicht zugeordnete Zeilen. Diese Zahlen sind der Wächter. Wenn
eine neue Kartenversion kommt und eine davon springt, hat sich das Layout
bewegt und die Schwellen gehören nachgemessen.

---

## 5. Bewertungen (angebunden am 06.09.2026)

Aggregierte Bewertungen sind Teil des Ziels, aber die Rechtslage passt nicht
ohne Weiteres zu einer statischen, cookiefreien Seite.

| Quelle | Lage |
|---|---|
| **Google Places** | Liefert Rating, Anzahl, Öffnungszeiten. Dauerhaft speichern darf man nur die `place_id`, Koordinaten 30 Tage. Ein datierter Snapshot im Repo wäre genau das, was die Terms ausschließen. Live aus dem Browser hieße sichtbarer API-Key, also bräuchte es einen serverseitigen Proxy. |
| **Tripadvisor** | Die Content API ist zum 31.08.2026 abgeschaltet. Nachfolger ist die self-serve Terra API, erste 1000 Aufrufe frei, danach pro Aufruf. Attribution mit Bubble-Rating und Datum ist Pflicht. |
| **Yelp** | Kein kostenloses Kontingent mehr, ab etwa 8 $ pro 1000 Aufrufen. Abdeckung in Kleinstädten dünn. |
| **werkenntdenbesten, Golocal** | Keine öffentliche API. Nur Scraping, und damit das rechtlich wackeligste Feld. |
| **OpenStreetMap über Overpass** | Keine Bewertungen, aber ohne Key, ohne Kosten und ohne Cookies: Koordinaten, Adresse, `opening_hours`, `cuisine`, `diet:vegan`, Website, Telefon. |

| **Restaurant Guru** | `robots.txt` erlaubt die Stadtlisten, `Crawl-delay: 1`. Note und Stimmenzahl stehen als `schema.org/AggregateRating` in der Seite. |

**Entschieden am 06.09.2026:** angebunden, aber nur dort, wo es sauber geht.

- **Restaurant Guru**: Note, Stimmen und Link für 25 Häuser, über
  `etl/reviews.py`, mit der verlangten Pause von einer Sekunde und unter
  eigenem User-Agent.
- **Google Maps**: nur der Suchlink, für alle 49 Häuser. `robots.txt` sperrt
  `/maps/`, erlaubt aber ausdrücklich `/maps/?q=`. Für Werte bräuchte es die
  Places API, und deren Bedingungen verbieten das dauerhafte Speichern —
  genau das, wofür dieses Repo da ist.
- **Tripadvisor**: gar nicht abgefragt. Antwortet auf jede
  nicht-Browser-Anfrage mit HTTP 403, und die Bedingungen untersagen
  automatisierten Zugriff unabhängig von der Menge. Links müssen von Hand
  kommen; `merge()` in `etl/reviews.py` lässt fremde Einträge stehen, damit
  sie jeden Lauf überleben.

Zuordnung über den Namen, exakt oder eindeutig enthalten. Zwei Kandidaten
heißt nicht zugeordnet: eine falsch angehängte Note steht unter dem Namen des
falschen Hauses, und das ist schlimmer als eine fehlende. Drei Fälle waren
von Hand zu klären, weil Guru sie unter dem Vorgängernamen führt: LariFari als
`BB-Lounge`, Necmi's als `Necmis-Catering`, das Wiesender Café als
`Naturbackstube Wiesender`. Beim letzten hat die Anschrift entschieden,
Stadtpl. 17 mit denselben Öffnungszeiten. Solche Fälle stehen in `OVERRIDE`.

In der App tragen die Bewertungen eine Sternreihe, den Link zur Quelle, das
Abrufdatum und den Hinweis, dass es fremde Meinungen sind und wer dafür
verantwortlich ist.

---

## 6. Was die App daraus macht

Vier Dinge, die nicht offensichtlich aus den Daten folgen:

**Gleiche Produkte in einer Zeile.** Espresso, Radler und Hugo stehen auf jeder
zweiten Karte. Untereinander gelistet ergeben sie eine Wand aus
Wiederholungen. `lib/group.ts` fasst sie zusammen und zeigt die Preisspanne,
aufklappbar bis zum einzelnen Haus.

Das geschieht auf zwei Wegen. Maschinell über den Wortkern: Mengen, Klammern
und Ziffern fallen weg, `Coca Cola Fl. 0,33l` und `Coca Cola` treffen sich.
Der Wortkern reicht aber nur bis `Espresso` gleich `Espresso`. Er sieht nicht,
dass `Tafelwasser still` und `Stilles Wasser` dasselbe sind, und er darf es
auch nicht raten: sechs Häuser teilen sich das Wort `Salat` mit fünfzehn
völlig verschiedenen Gerichten, vier das Wort `Curry`. Wer nach
Wortüberschneidung zusammenfasst, legt den Papayasalat neben den Wurstsalat.

Deshalb der zweite Weg, `data/vocab/produkte.json`: dort steht ausgeschrieben,
welche Schreibweisen dasselbe Produkt meinen. Die Regel dafür steht in der
Datei selbst. Zusammengefasst wird, wo der Unterschied Wortwahl, Marke einer
Massenware oder Portionsgröße ist; nicht zusammengefasst wird, wo der
Unterschied eine Sorte ist, zwischen der ein Gast wählt: hell und dunkel, süß
und trocken, mit und ohne Alkohol. Was dort nicht steht, bleibt für sich. Aus
753 Gerichten werden so 603 Zeilen, 59 Produkte stehen in mehreren Häusern.

**Gänge statt Preis als Ordnung.** Die Gerichtsliste war nach Preis sortiert
und begann deshalb mit der Knoblauchsauce für 40 Cent; wer ein Hauptgericht
suchte, kam an dreißig Getränken vorbei. Jetzt gliedert sie nach Gang, und der
kommt aus der Überschrift der gedruckten Karte.

Das ist dasselbe Problem wie beim Produktkatalog, eine Stufe höher: was bei
den Drei Tannen „Schmankerl" heißt, heißt bei Alexander „FLEISCHGERICHTE VOM
GRILL" und bei Necmi „Grill Gerichte". 203 verschiedene Überschriften stehen
im Bestand. `data/vocab/gaenge.json` ordnet sie dreizehn Gängen zu, erst über
den vollen Wortlaut, dann über geordnete Wortregeln; geprüft wird auf
Wortanfänge, damit `suppe` auch `Suppen` trifft und `eis` trotzdem nicht das
`Reis`. Was nichts trifft, wird `andere` und bleibt sichtbar:
`python etl/gaenge.py` zeigt die Verteilung und jede Überschrift ohne Regel.
Stand heute trifft eine einzige keine Regel, und die ist bewusst so gesetzt
(„Das solltest du nicht verpassen!" bei den Drei Tannen mischt Nachspeise und
Getränk).

Anders als beim Produktkatalog wird hier also mit Regeln gearbeitet und nicht
mit einer vollständigen Liste. Der Grund ist der Einsatz: eine falsch
zugeordnete Überschrift stellt ein Gericht in den falschen Abschnitt, eine
falsch zusammengefasste Zeile stellt den Preis des einen Hauses unter den
Namen des anderen.

**Öffnungszeiten ohne fremde Bibliothek.** `lib/hours.ts` liest den Ausschnitt
des OSM-Formats, den die Daten brauchen. `opening_hours.js` kann mehr, wiegt
aber 250 kB gegen die 59 kB, mit denen hier die ganze Karte startet. Der
schwierige Teil ist das Komma: es trennt mal Wochentage, mal Zeitspannen, mal
Regeln. Statt das aufzudröseln sucht ein Muster global nach „Tagliste, dann
Zeit" und überliest die Trenner. 40 der 41 Angaben lassen sich so lesen, die
eine übrige lautet „nach Spielzeit".

**Filter an einer Stelle.** `lib/filters.ts` hält den ganzen Zustand und beide
Prüfungen. Verteilt lägen die Regeln in Liste, Karte und Filterblatt, und die
Karte zeigte irgendwann etwas anderes als die Liste darunter.

Diese vier sind mit `pnpm test` geprüft, gegen erfundene Fälle und gegen die
echten Daten. Sie sind der einzige Ort im Repo, an dem ein stiller Fehler
plausibel aussähe.

## 7. Technik

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

## 8. Ordnung im Repo

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
