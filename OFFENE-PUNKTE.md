# Offene Punkte

*Stand: 06.09.2026*

## Braucht eine Entscheidung

- **Bewertungen.** Zurückgestellt, Recherchestand in KONTEXT.md, Abschnitt 5.
  Das Schema hält den Platz frei.
- **moosburg.eu.** Die zweite Adresse braucht `moosburg-eu.yml` mit
  FTP-Deploy nach `/data/foodhub/`, das Muster steht in
  `baumkarte/PLATTFORM.md`. Dafür fehlen die drei Secrets im Repo
  (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`), sie sind nicht von einem
  anderen Repo übertragbar. Dort ist auch vermerkt, warum der Deploy dieser
  Familie 300 s Timeout braucht und dass `dangerous-clean-slate` die
  Geschwister-Apps mitlöschen würde.
- **Die Zählung** gehört dazu: `<script src="/assets/zaehler.js" defer></script>`
  vor `</body>`, mit absolutem Pfad, sobald die App auf moosburg.eu läuft. Auf
  GitHub Pages läuft der Aufruf absichtlich ins Leere, damit die Zwillinge die
  Zahlen nicht verdoppeln.

## Daten

- **Bestell- und Lieferlinks sind vorbereitet, aber leer.** `Restaurant.ordering`
  nimmt sie samt Anbieter und Herkunft auf, die App zeigt sie als Knopf. OSM
  führt nur `delivery=yes` und `takeaway=yes`, keinen Link; der muss von Hand
  oder von der Seite des Hauses kommen. 13 Häuser haben in OSM immerhin
  `website:menu`.
- **Bilder zu den Gerichten fehlen ganz.** Das Schema hat `MenuItem.image`,
  gefüllt ist nichts. Die ergiebigste Quelle liegt im Asia-Rose-PDF mit seinen
  96 freigestellten Aufnahmen.
- **Asia Rose ist noch nicht eingelesen.** Das PDF hat keinen Textlayer, die
  Schrift ist in Kurven umgewandelt. Dafür liegen darin die genannten 96
  Gerichtsbilder, eines je Gericht, kreisförmig und sauber zuzuordnen. Die
  Karte ist von 2022, vier Jahre alt; eine aktuellere Fassung wäre zu suchen.
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
