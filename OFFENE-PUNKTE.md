# Offene Punkte

*Stand: 06.09.2026, abends*

## Braucht eine Entscheidung

- **Bewertungen.** Zurückgestellt, Recherchestand in KONTEXT.md, Abschnitt 5.
  Das Schema hält den Platz frei.
- **moosburg.eu braucht nur noch die Secrets.** `.github/workflows/moosburg-eu.yml`
  steht, der Zähler ist eingebunden. Fehlen die drei Zugangsdaten im Repo
  unter Settings, Secrets and variables, Actions: `FTP_HOST`, `FTP_USER`,
  `FTP_PASSWORD`, mit denselben Werten wie in `baumkarte`. Sie sind nicht von
  einem Repo ins andere übertragbar, GitHub hält sie je Repo.

## Karten, die noch warten

Alle sechs haben einen Textlayer, die Quellen liegen unter `sources/moosburg/`.

- **Da Sophie e Massimo.** Der Parser steht (`etl/menu_da_sophie.py`) und
  liest sauber, aber der PDF-Ausdruck enthält nur 38 der geschätzt 120
  Gerichte: die Seite lädt die Karte über ein Joomla-Modul nach, und der
  Ausdruck hat nur erwischt, was beim Drucken schon da war. Die erzeugte
  Kartendatei ist deshalb wieder gelöscht. 38 von 120 unter dem Namen des
  Hauses zu zeigen wäre schlechter als nichts zu zeigen: wer dort nach einer
  Pizza sucht, fände genau eine. Gebraucht wird entweder ein vollständiger
  Ausdruck oder die Adresse, unter der das Modul seine Daten holt.
- **Café Woch'nblatt**, **Iss Wurscht**, **Amrutham**, **Necmi's Pizza and
  more**, **Rosenhof**: noch nicht angesehen.
- **Iss Wurscht** und **Amrutham** haben noch keinen Eintrag unter
  `data/moosburg/restaurants/`. OSM kennt sie unter diesen Namen nicht, beide
  brauchen also Stammdaten von Hand: Anschrift, Koordinaten, Öffnungszeiten.

## Daten

- **Bestell- und Lieferlinks sind vorbereitet, aber leer.** `Restaurant.ordering`
  nimmt sie samt Anbieter und Herkunft auf, die App zeigt sie als Knopf. OSM
  führt nur `delivery=yes` und `takeaway=yes`, keinen Link; der muss von Hand
  oder von der Seite des Hauses kommen. 13 Häuser haben in OSM immerhin
  `website:menu`.
- **Bilder zu den Gerichten fehlen ganz.** Das Schema hat `MenuItem.image`,
  gefüllt ist nichts. Die ergiebigste Quelle liegt im Asia-Rose-PDF mit seinen
  96 freigestellten Aufnahmen.
- **Die Karte von Asia Rose ist von 2022**, vier Jahre alt. Eine aktuellere
  Fassung wäre zu suchen. Im PDF liegen außerdem die genannten 96
  Gerichtsbilder.
- **Tripadvisor-Links fehlen.** Die Seite antwortet auf jede
  nicht-Browser-Anfrage mit HTTP 403 hinter einer Bot-Sperre, und die
  Nutzungsbedingungen untersagen automatisierten Zugriff unabhängig von der
  Menge. `etl/reviews.py` lässt fremde Einträge stehen, von Hand eingetragene
  Links überlebt also jeder Lauf.
- **Google Maps liefert nur den Link, keine Bewertung.** Für Werte bräuchte es
  die Places API mit Schlüssel und Abrechnung, und deren Bedingungen erlauben
  kein dauerhaftes Speichern der Werte. Das verträgt sich nicht mit einem
  Repo, dessen Zweck das Aufbewahren mit Abrufdatum ist.
- **23 Häuser haben keinen Eintrag bei Restaurant Guru.** Meist kleinere
  Betriebe. Beim `Wiesender Café` ist die Zuordnung bewusst leer: Guru führt
  dort eine dritte Wiesender-Filiale, und welche der beiden anderen gemeint
  wäre, ist nicht zu entscheiden.
- **43 weitere Gaststätten führt OSM in Moosburg** ohne eingelesene Karte. Sie
  stehen auf der Karte als offene Ringe, die Speisekarten sind das, was
  einzelne Häuser darüber hinaus haben.
- **Quell-URLs fehlen** für AN und Asia Rose. Für die übrigen fünf sind sie
  belegt.
- **Der Produktkatalog will gepflegt werden.** `data/vocab/produkte.json` sagt
  ausgeschrieben, welche Schreibweisen dasselbe Produkt meinen. Eine neue Karte
  bringt neue Schreibweisen, und die fallen erst auf, wenn zwei Zeilen
  nebeneinander stehen, die eine sein sollten. Ein Test hält wenigstens fest,
  dass jede eingetragene Schreibweise in Normalform steht.

## Kleinere Funde beim Einlesen

- **Westerberg-Stub'n: Abschnitte und Vegetarisch-Zeichen sind Grafik.** Die
  handgeschriebenen Überschriften und das grüne Blatt stehen als Bild in der
  Seite, nicht im Text. Beides ist im Parser von Hand eingetragen, abgelesen
  von den gerenderten Seiten. Das ist die einzige Stelle im Bestand mit von
  Hand gepflegten Inhalten und wird bei einer neuen Kartenfassung als Erstes
  falsch.
- **Staudinger Keller: die Karte erklärt den Zusatzstoff 1 nicht.** Sie führt
  10, 8, 7, 4 und 3 auf, verwendet aber auch eine 1. Sieben Getränke tragen
  sie, sie bleibt unbekannt.
- **La Forchetta und Staudinger Keller: Aufpreise nicht übernommen.** Pizzabelag
  und Umbestellungen sind keine Gerichte. Bei La Forchetta stehen sie als
  Komma-Liste je Preis, beim Staudinger Keller in zwei Abschnitten `Extras`.
  Beides ist in der Herkunft vermerkt.
- **Westerberg-Stub'n: der Sonntagsbraten hat keinen Preis.** Er wird auf der
  Karte nur angekündigt.
- **AN: sechs Gerichte tragen den Marker `j`**, den die Zeichenerklärung der
  Karte nicht kennt, sie springt von i auf k. Betroffen sind Red Dragon,
  California Roll und vier Sushi-Menüs.
- **AN: 13 Gerichte ohne Preis**, und bei 90 bis 92 ist die Beschreibung als
  Name gelandet. Fehler aus dem außerhalb erzeugten Extrakt, nicht aus dem
  Einlesen hier.
- **Drei Tannen: die Mittagskarte** nennt einen Preis für vier Gerichte
  gemeinsam. Erfasst wird nur das erste.
- **Maharaja: der Spirituosen-Abschnitt** heißt „2cl 4cl", weil die Überschrift
  daneben steht und nicht darüber.
- **Maharaja: die Positionen 226 bis 228** heißen alle „Mango Cream". Das steht
  so auf der Karte, kein Lesefehler.

## Technik

- **Der Kartenstil wiegt 490 kB und kommt von fremder Stelle.** Sein Abruf
  beginnt jetzt beim Start statt hinter den Hausdaten, und die zwölf
  ausgeblendeten Piktogrammebenen samt der drei mit `fill-extrusion` fliegen
  vor dem Bau heraus. Was danach bleibt, ist der Abruf selbst: gemessen 0,85 s.
  Eine eigene Kopie im Repo wäre schneller, ginge aber still veralten, wenn der
  Bund seinen Stil ändert.
- **Das JS-Bündel wiegt 1,26 MB, gepackt 345 kB.** Fast alles davon ist
  MapLibre.
- Der Spaltenteiler zerschneidet Zeilen, die über beide Spalten laufen. Trifft
  einzelne Fließtexthinweise. Wäre lösbar, indem solche Zeilen erkannt und
  wieder zusammengeführt werden, lohnt aber erst, wenn es stört.
