# Offene Punkte

*Stand: 05.09.2026*

## Braucht eine Entscheidung

- **Koordinaten der vier Häuser.** Für die Karte nötig. Overpass könnte sie
  liefern und gleich Adresse, `opening_hours` und `cuisine` mitbringen, ohne
  Key und ohne Cookies. Wäre zugleich die Probe darauf, ob OSM als Stammdaten-
  quelle trägt.
- **Bewertungen.** Zurückgestellt, Recherchestand in KONTEXT.md, Abschnitt 5.
  Das Schema hält den Platz frei.
- **Vier neue Karten liegen bereit, noch nicht eingelesen:** Staudinger Keller
  (16 Seiten, einspaltig, sehr regelmäßig), Westerberg-Stub'n mit Speise- und
  Getränkekarte, La Forchetta (2 Seiten, italienisch). Alle vier haben einen
  Textlayer. Stammdaten und Koordinaten stehen bereits.

## Daten

- **45 weitere Gaststätten führt OSM in Moosburg**, mit Koordinaten, Adresse,
  `opening_hours` und `cuisine`, viele mit `website:menu`. Sie ließen sich als
  Grundstock anlegen, dann zeigte die Karte die ganze Stadt und die
  Speisekarten wären das, was einzelne Häuser darüber hinaus haben.

- **Asia Rose ist noch nicht eingelesen.** Das PDF hat keinen Textlayer, die
  Schrift ist in Kurven umgewandelt. Dafür liegen **96 freigestellte
  Gerichtsbilder** darin, eines je Gericht, kreisförmig und sauber zuzuordnen.
  Das ist die ergiebigste Bildquelle im ganzen Bestand.
- **Die Karte von Asia Rose ist von 2022.** Vier Jahre alt, Preise und
  Öffnungszeiten entsprechend unsicher. Eine aktuellere Fassung wäre zu suchen.
- **Quell-URLs fehlen** für AN und Asia Rose. Bei Drei Tannen und Maharaja sind
  sie belegt.
- **Kontaktdaten von AN** fehlen bis auf die Adresse.

## Kleinere Funde beim Einlesen

- **AN: sechs Gerichte tragen den Marker `j`**, den die Zeichenerklärung der
  Karte nicht kennt, sie springt von i auf k. Betroffen sind Red Dragon,
  California Roll und vier Sushi-Menüs. Zu klären, wenn jemand die Bildseiten
  prüft.
- **AN: 13 Gerichte ohne Preis**, und bei 90 bis 92 ist die Beschreibung als
  Name gelandet. Fehler aus dem außerhalb erzeugten Extrakt, nicht aus dem
  Einlesen hier.
- **Drei Tannen: die Mittagskarte** nennt einen Preis für vier Gerichte
  gemeinsam. Erfasst wird nur das erste.
- **Drei Tannen: die Bierkarte** ist als mehrspaltige Tabelle gesetzt, die
  weder dem zweispaltigen noch dem einspaltigen Muster folgt, und fällt in eine
  verstümmelte Zeile. Betrifft einen Eintrag von 139.
- **Maharaja: der Spirituosen-Abschnitt** heißt „2cl 4cl", weil die Überschrift
  daneben steht und nicht darüber.
- **Maharaja: die Positionen 226 bis 228** heißen alle „Mango Cream". Das steht
  so auf der Karte, kein Lesefehler.

## Technik

- **Die Kartenfläche ist visuell ungeprüft.** Im Screenshot bleibt sie leer,
  während Zoom, Maßstab und Quellenangabe erscheinen. Das spricht dafür, dass
  MapLibre läuft und nur der WebGL-Canvas nicht in den Screenshot gelangt,
  bewiesen ist es nicht. Ein Blick in einen echten Browser klärt es in einer
  Sekunde.
- **Unter 548 px ist das Layout ungeprüft.** Headless-Chrome und -Edge haben
  auf diesem Rechner eine Mindestfensterbreite von 548 px und beschneiden
  schmalere Aufnahmen nur, statt schmaler zu rendern. Bei 548 px stimmt der
  Umbruch. Für ein Telefon mit 390 px fehlt der Nachweis.
- **Deploy ist noch nicht eingerichtet**, weder GitHub Pages noch moosburg.eu.
  Die Build-Skripte stehen, die Workflows fehlen.
- Der Spaltenteiler zerschneidet Zeilen, die über beide Spalten laufen. Trifft
  einzelne Fließtexthinweise. Wäre lösbar, indem solche Zeilen erkannt und
  wieder zusammengeführt werden, lohnt aber erst, wenn es stört.
