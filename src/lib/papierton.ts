/**
 * Grundkarte in den Papierton der Familie ziehen (Formsprache-Probe, Punkt 8).
 *
 * Jede Farbangabe im Stil wird kanalweise mit Creme multipliziert. Weiss wird
 * damit zu Creme, Schwarz bleibt Schwarz, und alles dazwischen behaelt seine
 * Ordnung. Das ist derselbe Griff wie `background-blend-mode: multiply`, nur
 * im Stil statt auf der Flaeche: MapLibre zeichnet sonst nichts, was man
 * ueberblenden koennte, ohne auch die Baeume mitzufaerben.
 *
 * Es wird rekursiv durch `layers[].paint` gegangen, samt Ausdruecken
 * (`interpolate`, `match`, `case`), weil Farben dort in den Zweigen stehen.
 * Keine Ebene wird beim Namen angesprochen.
 *
 * Behandelt werden `rgb()`, `rgba()` und Hex. Nachgezaehlt am Stil
 * bm_web_gry.json vom 28.09.2026: 557 Ebenen, 614 Farbangaben, alle in
 * `rgb()`. Hex steht trotzdem hier, weil es die uebliche zweite Schreibweise
 * in MapLibre-Stilen ist und sechs Zeilen kostet; `hsl()` kommt nicht vor und
 * ist deshalb auch nicht gebaut.
 */
const CREME = [250 / 255, 247 / 255, 242 / 255] as const;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*([^)]+?)\s*\)$/i;

/**
 * Eine einzelne Farbangabe toenen. Liegt keine der Schreibweisen vor, kommt
 * der Wert unveraendert zurueck, dann ist es keine Farbe.
 */
export function toene(wert: string): string {
  const hex = HEX.exec(wert);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((z) => z + z).join("") : hex[1];
    const kanaele = [0, 2, 4].map((i) =>
      Math.round(parseInt(h.slice(i, i + 2), 16) * CREME[i / 2]),
    );
    return "#" + kanaele.map((k) => k.toString(16).padStart(2, "0")).join("");
  }

  const f = RGB.exec(wert);
  if (!f) return wert;
  const teile = f[1].split(/[\s,/]+/);
  if (teile.length < 3) return wert;

  const [r, g, b] = teile
    .slice(0, 3)
    .map((t, i) => Math.round((t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t)) * CREME[i]));
  return teile[3] === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${teile[3]})`;
}

/** Rekursiv durch einen Paint-Block, Ausdruecke eingeschlossen. */
function durch(knoten: unknown): unknown {
  if (typeof knoten === "string") return toene(knoten);
  if (Array.isArray(knoten)) return knoten.map(durch);
  if (knoten && typeof knoten === "object") {
    return Object.fromEntries(Object.entries(knoten).map(([k, v]) => [k, durch(v)]));
  }
  return knoten;
}

/** Den Stil in den Papierton ziehen. Der Stil wird dabei nicht veraendert. */
export function papierton<T extends { layers?: unknown[] }>(style: T): T {
  if (!Array.isArray(style.layers)) return style;
  return {
    ...style,
    layers: style.layers.map((ebene) => {
      const e = ebene as { paint?: unknown };
      return e && typeof e === "object" && e.paint ? { ...e, paint: durch(e.paint) } : ebene;
    }),
  };
}
