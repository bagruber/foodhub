# Formsprache in den Speisekarten: Ergebnis der Probe

*Stand 28.09.2026. Gebaut auf `probe/formsprache`, **nicht gemergt und nicht
gepusht**. Die Entscheidungen sind **vorläufig**: Kanon ist allein
`../moosburg-design/css/theme.css`, das Protokoll dort führt den Verlauf.*

Grundlage: `../moosburg-design/docs/formsprache/briefing-karten.md` (AP 0 bis 10) und
die Vorlage [Karten, erste Lesung](https://claude.ai/artifact/P9KpGjEkzRw94DcB2hZ8Rw),
Version 3. Vorher- und Nachher-Aufnahmen liegen lokal unter `vorher/` und `nachher/`
(per `.git/info/exclude` ausgenommen), aufgenommen unter `/data/foodhub/`.

**Hier liegt die Probe zu Punkt 6.** Die anderen beiden Karten haben keine Chips.

## Was jetzt gilt

| Bereich | Umsetzung | Commit |
|---|---|---|
| Schriften | Inter und Playfair raus, Source Serif 4 und Atkinson Hyperlegible Next rein, `font-feature-settings` entfernt. Das war der Nachzug: die anderen beiden Karten hatten den Wechsel schon. | `ff3747a` |
| Kanon und Pakete | `moosburg-design` von 0.1.0 auf 0.3.0, Phosphor aufgenommen. `@types/node`, `@types/react-dom` und `@vitejs/plugin-react` von 26.4.1 / 19.2.7 / 6.1.1 auf die Stände der Hausbasis zurückgezogen, sie waren nach oben gedriftet. | `ff3747a` |
| Zeichen | `Icons.tsx` kommt jetzt aus Phosphor. Achtzehn der zwanzig Zeichen haben eine Entsprechung, die Namen bleiben, damit die Aufrufstellen unverändert lesen. | `610b9f3` |
| Schrift | `.headline` und `.eyebrow` gelöscht, dafür `.mess-label`. Die Gruppenköpfe der Gerichteliste stehen in Satzschreibung, kleben weiter und haben ihren `backdrop-blur` verloren. | `610b9f3` |
| Kleinster Lesegrad | 12 px. Vorher 0,65 rem (10,4 px) an den Merkmalen der Gerichte und am Öffnungszeiten-Etikett, 0,6875 rem an den Zeilen der Hausliste. | `610b9f3` |
| Kopfband | Stripe, darunter das Band in Aubergine. Kennzahl „1.714 Gerichte aus 16 Häusern", gerechnet aus `restaurants.json` (Summe `dishCount`, Häuser mit `dishCount > 0`), nicht aus der später geladenen `dishes.json`. Der Desktop-Kopf mit Kicker und Versal-Titel ist entfallen. | `610b9f3` |
| Seitenleiste | Von 26 auf 25 rem. | `610b9f3` |
| Blatt | Behält seine drei Rastungen, Radius von 16 auf 8 px. | `610b9f3` |
| Zeiger | `--zeiger: var(--color-thema-aubergine)`. Der Uhrzeit-Regler im Filterblatt nimmt ihn über `accent-color` statt `accent-red-500`. | `610b9f3` |
| Gesetzte Filter | Gold-700 auf Gold-100, Rand Gold-500, halbfett. Eine Klasse `.chip-an` in `index.css`, gilt für die Schnellfilter, die Chips im Filterblatt und den Knopf „Filter", der weiter seine Zahl trägt. | `610b9f3` |
| Grundkarte | `papierton()` nach dem Ausdünnen, in `preloadBasemap()`. | `610b9f3` |
| Rückfall | Graue TopPlusOpen. **Vorher gab es gar keinen**: bei einem Ausfall standen die Punkte auf leerer Fläche, ohne Hinweis. Der Quellenvermerk nennt jetzt, was geladen wurde. | `610b9f3` |
| Kartenknöpfe | Eigene Gruppe mit Phosphor `Plus`, `Minus`, `Crosshair`, 4 px, nur mit Maus. Am Telefon ein Standort-Knopf 42 × 42 unten rechts, der mit der Rastung des Blatts wandert. | `610b9f3` |
| Meterstab | Wie in den anderen beiden. | `610b9f3` |
| Auswahlmarke | Klecks 44 px, Fläche `red-100`, Rand Creme 2,5 px, darin `ForkKnife` bold in `red-700`. Dazu ein bleibender Hof von 84 px und ein Ring, der beim Wählen einmal ausläuft. Der Punkt des gewählten Hauses wird aus der Punktebene gefiltert. | `610b9f3` |
| Laden | Drei Kacheln mit Rosen in Aubergine beim ersten Laden. Beim ersten Holen von `dishes.json` dreht sich an der Stelle der Kennzahl eine Rose mit „Gerichte werden geladen"; der Ladetext in der Liste ist entfallen. | `610b9f3` |
| Zeilen der Hausliste | „Restaurant" fällt aus der Aufzählung, Gasthof, Café und Imbiss bleiben. Trenner Komma statt Mittelpunkt. Rechts „210 Gerichte" in `ink-soft` statt des roten Etiketts mit nackter Zahl. | `610b9f3` |
| Suche | Platzhalter im Gerichte-Modus „Was gibt es zu essen?" | `610b9f3` |

## Die beiden Ersatzvarianten

**Punkt 6, gesetzte Filter: Gold zurück auf voll Rot.** Eine Klasse in
`src/index.css`, die Ersatzzeile steht als Kommentar direkt darüber:

```css
/* Ersatz 6: border-red-500 bg-red-500 text-white */
.chip-an {
  border-color: var(--color-gold-500);
  background: var(--color-gold-100);
  color: var(--color-gold-700);
  font-weight: 600;
}
```

Umschalten heißt: den Rumpf von `.chip-an` durch `border-color: var(--color-red-500);
background: var(--color-red-500); color: #fff;` ersetzen. Drei Aufrufstellen lesen die
Klasse (Knopf „Filter" und `Quick` in `src/App.tsx`, `Chip` in
`src/components/FilterSheet.tsx`), keine davon muss angefasst werden.

**Punkt 7A, Zeiger in Rot.** Eine Zeile in `src/index.css`:

```css
:root {
  --zeiger: var(--color-thema-aubergine);
  /* Ersatz 7A: --zeiger: var(--color-red-700); */
}
```

Betrifft hier nur den Uhrzeit-Regler im Filterblatt.

## Beobachtungen aus AP 4, am gebauten Stand angesehen

**Gold-Chips neben den roten Punkten der Speisekarten.** Sie begegnen sich weniger,
als ich erwartet hatte. Am Schreibtisch stehen die Chips in der 400-px-Leiste links,
die Punkte auf der Karte rechts, dazwischen eine Haarlinie: zwei getrennte Felder, und
das Gold liest sich dort ruhig als „gesetzt", ohne mit dem Rot zu konkurrieren.
Aufnahme `nachher/desktop-filter.png` mit „Filter 2", „offen 13:34" und
„vegetarisch" gesetzt, „vegan" ruhig.

Am Telefon liegen sie näher beieinander, die Chipreihe steht im Blatt unmittelbar
unter der Kartenfläche mit den roten Punkten (`nachher/telefon-ruhe.png`). Auch dort
stört es nicht, weil das Blatt eine eigene Fläche mit Kante ist. **Mein Eindruck: Gold
gewinnt.** Voll Rot zog vorher die Aufmerksamkeit auf die Bedienleiste statt auf die
Karte, und Rot ist in dieser App bereits die Farbe der Daten (Häuser mit Karte,
Klecks). Gold trennt Bedienung von Daten, was Rot hier nicht kann.

Der einzige Einwand: Gold-700 auf Gold-100 sind 5,64:1, weniger als Weiß auf Rot-500
(5,88:1), und bei kleinen Chips in 12 px ist das spürbar. Beide erfüllen AA.

**Der Aubergine-Zeiger** steht nur im Filterblatt am Uhrzeit-Regler und begegnet dort
keiner Datenfarbe. Gegen die roten Punkte wären es 2,33:1, aber die beiden liegen nie
nebeneinander.

## Messwerte

| Stelle | Wert |
|---|---|
| Creme auf dem Band (Aubergine) | 12,81:1 |
| Gold-200 auf dem Band (Kennzahl) | 9,44:1 |
| Rücklink, Creme 85 % auf dem Band | 9,67:1 |
| Einheit, Creme 82 % auf dem Band | 9,12:1 |
| **Gold-700 auf Gold-100 (Probe 6)** | **5,64:1** |
| Ersatz 6: Weiß auf red-500 | 5,88:1 |
| `red-700` auf `red-100` (Zeichen im Klecks) | 6,52:1 |
| `ink-soft` auf Creme (`.mess-label`, Meterstab, „210 Gerichte") | 6,98:1 |
| `ink-muted` auf Creme (12 px) | 4,96:1 |

| Größe | Messwert |
|---|---|
| Seitenleiste ab `lg` | 25 rem = 400 px |
| `scrollWidth` / `clientWidth` bei 390 px | 390 / 390 |
| `scrollWidth` / `clientWidth` bei 1440 px | 1440 / 1440 |
| Ring der Auswahlmarke, gemessen | 80 ms: Skalierung 1,06 Deckkraft 0,63 · 200 ms: 1,24 / 0,49 · 350 ms: 1,86 / 0,03 · 500 ms: 1,90 / 0 |

## Prüfungen

- `pnpm typecheck`, `pnpm build`, `pnpm build:hostinger`, `pnpm test` grün
  (39 Tests, davon 9 neue für `papierton`).
- `grep -rn "eyebrow\|headline\|uppercase\|accent-red\|text-\[0\.[0-6]" src` leer bis
  auf die Kommentarzeile mit dem Ersatz in `index.css`.
- Kein waagrechter Überlauf bei 390 und 1440 px.
- Tastatur bei 390: Rücklink, Panel, Karte, Quellenvermerk, drei Kartenknöpfe, Griff
  des Blatts, Umschalter, Suche, Chips. Panel: `aria-expanded` wechselt, Esc schließt,
  der Fokus kehrt zum Knopf zurück.
- **Papierton am echten Stil nachgezählt** (bm_web_gry.json, 28.09.2026): 557 Ebenen,
  614 Farbangaben, alle getönt. Weiß wird exakt `#faf7f2`.
- **Rückfall geprüft** mit `page.route` und `abort` auf basemap.de: 39 TopPlusOpen-Kacheln
  geladen, graue Karte mit Punkten, Quellenvermerk „TopPlusOpen, © Bundesamt für
  Kartographie und Geodäsie" (`nachher/rueckfall-topplus.png`).
- **Auswahlmarke belegt** in `nachher/klecks.png`: Klecks mit Hof, der Punkt darunter
  ist ausgeblendet.
- Ein 404 bleibt: `/assets/zaehler.js`. Der ist beabsichtigt und in `index.html`
  erklärt, die Datei liegt nur auf moosburg.eu.

## Gefundene Fehler und offene Punkte

- **`Marker.addTo()` liest die Koordinaten sofort.** Die Marke wurde zuerst angelegt
  und an die Karte gehängt und erst danach verortet; MapLibre warf dabei
  „Cannot read properties of undefined (reading 'lng')", und die ganze Karte fiel aus
  dem Baum. Jetzt `setLngLat().addTo()` in dieser Reihenfolge.
- **MapLibres Stylesheet stand im Bundle hinter unseren Regeln**, wie in den anderen
  beiden Karten.
- **Zwei Karteninstanzen laufen gleichzeitig.** `App.tsx` rendert den Schreibtisch-
  und den Telefonaufbau beide, einer davon ist über `hidden lg:flex` beziehungsweise
  `lg:hidden` nur ausgeblendet. Damit stehen zwei MapLibre-Karten samt WebGL-Kontext
  im Speicher. Das ist **nicht neu**, es war vorher genauso, und ich habe es nicht
  angefasst, weil es außerhalb dieses Auftrags liegt. Aufgefallen ist es, weil die
  Auswahlmarke deshalb zweimal existiert. Einen Aufbau zu bauen und per CSS
  umzuräumen wäre die Lösung, das ist aber ein eigener Umbau.
- **„Kein Tracking" steht nicht im Panel.** Das Briefing lässt den Satz aus der
  Baumkarte ins Panel wandern. Hier steht er nicht, weil `index.html` die Zählung von
  moosburg.eu einbindet (`/assets/zaehler.js`, ohne Cookie und ohne Browser-Speicher,
  aber eine Zählung). In der Baumkarte und den Historischen Karten steht der Satz.
  **Sag Bescheid, wenn du ihn auch hier willst**, dann gehört eine genauere Formulierung
  hin als „kein Tracking".
- **Zwei Zeichen bleiben von Hand gezeichnet**, weil Phosphor sie nicht führt: das
  Kontaktlos-Zeichen der Kartenzahlung (genormtes Symbol, ein Ersatz aus dem Satz wäre
  eine andere Aussage) und der Stern der Herkunftsbewertung, der zu Teilen gefüllt sein
  muss. Beide stehen weiter in `src/components/Icons.tsx`.
- **Die „Vorher"-Aufnahmen zeigen schon die neuen Schriften.** Der Schriftwechsel war
  laut Briefing der erste Commit auf dem Branch (AP 0.6), und Inter und Playfair wieder
  zu installieren, nur um sie zu fotografieren, hätte die gerade hergestellte
  Deduplizierung im pnpm-Store wieder zerlegt. Der Wechsel selbst steht im Diff von
  `ff3747a`.
- **Ein Commit statt neun**, aus demselben Grund wie in den anderen beiden Karten.
