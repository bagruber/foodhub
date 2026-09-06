# Offene Punkte

*Stand: 06.09.2026, spät*

## Braucht eine Entscheidung

- **Iss Wurscht: geschlossen?** Der Foodtruck ist zurückgestellt, bis das
  geklärt ist. Die Karte liegt eingelesen bereit unter
  `sources/moosburg/iss-wurscht_speisekarte_2026-09-06.pdf` und wäre die
  einzige im Bestand, die **halal je Gericht** ausweist — bei elf Stellen im
  Text, samt eigenem Abschnitt „100 % Halal". Bestätigt sich die Schließung,
  bleibt sie draußen; sonst braucht sie Stammdaten von Hand, denn OSM kennt
  sie nicht.
- **Tripadvisor-Links.** Müssen von Hand kommen, siehe KONTEXT Abschnitt 5.
  Wenn Bewertungswerte von Hand nachgetragen werden sollen: möglich, mit
  `kind: manual` und Datum. Sie altern dann still, weil kein Lauf sie
  auffrischt — der Link altert nicht.

## Daten

- **Da Sophie: 38 Gerichte, und das ist die ganze Karte.** Die Nummern springen
  in Blöcken (10–15, 22–26, 30–36, 50, 60–84, 110–112). Das sah nach einem
  abgeschnittenen Ausdruck aus, ist aber keiner.
- **Amrutham ist der Nachfolger von Tattva** an derselben Anschrift. Der
  Eintrag ist von Hand angelegt: Ort aus dem Google-Maps-Eintrag, Karte aus
  der übergebenen Datei. Bewusst **ohne** Öffnungszeiten und ohne
  Ernährungsangaben, denn die in OSM hinterlegten beschreiben Tattva.
  `node/7725213368` steht dort noch unter dem alten Namen; `ABGELOEST` in
  `etl/osm.py` verhindert, dass jeder Lauf den geschlossenen Betrieb wieder
  anlegt. Die eigentliche Korrektur gehört nach OSM.
- **Halal steht nur an einem Haus**, und das war Tattva. Mit dessen Eintrag ist
  die Angabe entfallen; ob sie für Amrutham gilt, ist unbekannt. **Glutenfrei
  gibt es nirgends**, weder an einem Haus noch an einem Gericht. Aus den
  Allergenmarkern ließe sich „ohne glutenhaltiges Getreide" ableiten, und das
  ist etwas anderes als glutenfrei: letzteres ist ein Grenzwert von 20 mg/kg
  einschließlich Verschleppung in der Küche. Diese Ableitung fehlt deshalb.
- **Zahlungsarten: 21 von 49 Häusern haben eine Angabe.** EC- und Kreditkarte
  sind getrennt geführt (`payment:debit_cards`, `payment:credit_cards` aus
  OSM): 9 Häuser nehmen die Girocard, 8 die Kreditkarte, und ebenso viele
  schließen sie ausdrücklich aus — 7 die eine, 8 die andere. 7 nehmen die
  MoosburgCard. Neu dazu: das Woch'nblatt sagt auf der eigenen Seite, dass es
  kontaktlos zahlen lässt. Die übrigen 28 Häuser sind unbekannt, nicht
  verneint. Von Hand recherchieren ginge, braucht dann aber eine Quelle je
  Angabe.
- **Bestell- und Lieferlinks:** erster Eintrag steht, Necmi's eigener Shop.
  Für die übrigen fehlt der Link; OSM führt nur `delivery=yes`.
- **Bilder zu den Gerichten fehlen ganz.** Das Schema hat `MenuItem.image`.
  Die ergiebigste Quelle liegt im Asia-Rose-PDF mit seinen 96 freigestellten
  Aufnahmen.
- **Die Karte von Asia Rose ist von 2022**, vier Jahre alt.
- **24 Häuser haben keinen Eintrag bei Restaurant Guru.** Meist kleinere
  Betriebe.
- **34 weitere Gaststätten führt OSM in Moosburg** ohne eingelesene Karte.
- **Der Produktkatalog will gepflegt werden.** `data/vocab/produkte.json` sagt
  ausgeschrieben, welche Schreibweisen dasselbe Produkt meinen. Sechs neue
  Karten bringen neue Schreibweisen, und die fallen erst auf, wenn zwei Zeilen
  nebeneinander stehen, die eine sein sollten.
- **Die Gangzuordnung ebenso.** `python etl/gaenge.py` zeigt nach jeder neuen
  Karte, welche Überschriften keine Regel treffen.

## Kleinere Funde beim Einlesen

- **Woch'nblatt: die Zeichenerklärung ist gesperrt.** Die Karte verweist auf
  `/allergiker-im-woch-nblatt/`, und genau diesen Pfad listet die `robots.txt`
  des Hauses unter `Disallow`. 357 Marker bleiben deshalb ungedeutet. Geraten
  wird nicht: die Buchstaben sehen aus wie die übliche Reihe a bis n, sind es
  aber nicht, denn auf `Kugel Eis` steht `(d)`.
- **Woch'nblatt: zwei der vier Karten gelten tageweise.** Schmankerl der Woche
  02.–06.09.2026, Wochenendkarte 04.–06.09.2026. Das steht als Anmerkung am
  Abschnitt. Die App kennt keine Gültigkeit und zeigt sie wie alles andere.
- **Rosenhof: die Variationen mit Aufpreis fehlen.** Word hat sie in einen
  eigenen Rahmen gesetzt, ihre Preise stehen im Ausdruck versetzt zu ihren
  Zeilen. Erkennbar sind sie am Einzug, übernommen werden sie nicht.
- **Necmi's: vier Pizzen führen zwei Preise unter derselben Größe**, `Ø33cm`
  zweimal. Das ist ein Fehler des Shops, nicht des Ausdrucks; übernommen wird,
  was dort steht.
- **Amrutham: ein Marker `s`**, den die Karte nirgends erklärt, an `Spaghetti
  Napoli`. Die Geometrie sagt, dass dort ein Zeichen steht; was es bedeutet,
  bleibt offen.
- **Amrutham: keine Ernährungsangabe aus dem Wortlaut.** `Vegan möglich` in
  einer Beschreibung heißt nicht, dass das Gericht vegan ist, sondern dass es
  das auf Wunsch wird. Nur die beiden ausdrücklich vegetarischen Abschnitte
  setzen `vegetarian: declared`.
- **Westerberg-Stub'n: Abschnitte und Vegetarisch-Zeichen sind Grafik.** Von
  Hand eingetragen, abgelesen von den gerenderten Seiten. Wird bei einer neuen
  Kartenfassung als Erstes falsch.
- **Staudinger Keller: die Karte erklärt den Zusatzstoff 1 nicht.**
- **La Forchetta und Staudinger Keller: Aufpreise nicht übernommen.**
- **Westerberg-Stub'n: der Sonntagsbraten hat keinen Preis.**
- **AN: sechs Gerichte tragen den Marker `j`**, den die Zeichenerklärung nicht
  kennt.
- **AN: 13 Gerichte ohne Preis**, und bei 90 bis 92 ist die Beschreibung als
  Name gelandet. Fehler aus dem außerhalb erzeugten Extrakt.
- **Drei Tannen: die Mittagskarte** nennt einen Preis für vier Gerichte
  gemeinsam. Erfasst wird nur das erste.
- **Maharaja: der Spirituosen-Abschnitt** heißt „2cl 4cl", weil die Überschrift
  daneben steht und nicht darüber.
- **Maharaja: die Positionen 226 bis 228** heißen alle „Mango Cream". Das steht
  so auf der Karte, kein Lesefehler.

## Technik

- **Der Kartenstil wiegt 490 kB und kommt von fremder Stelle.** Sein Abruf
  beginnt beim Start statt hinter den Hausdaten, die zwölf ausgeblendeten
  Piktogrammebenen samt der drei mit `fill-extrusion` fliegen vor dem Bau
  heraus. Was bleibt, ist der Abruf selbst: gemessen 0,85 s.
- **`dishes.json` wiegt inzwischen 483 kB** gegen 297 kB vor den sechs neuen
  Karten. Sie wird erst geholt, wenn jemand nach einem Gericht sucht, aber bei
  der nächsten Stadt lohnt ein Blick darauf, was je Gericht wirklich mitmuss.
- **Das JS-Bündel wiegt 1,27 MB, gepackt 347 kB.** Fast alles davon ist
  MapLibre.
- Der Spaltenteiler zerschneidet Zeilen, die über beide Spalten laufen. Trifft
  einzelne Fließtexthinweise.
