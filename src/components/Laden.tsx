import { Rose } from "./Kopf";

/**
 * Erstes Laden: drei Kacheln mit Rosen auf der Kartenflaeche, wie der
 * RoseLoader im Stadt-Konzept. Die mittlere Kachel ist umgekehrt gefaerbt und
 * traegt die Themenfarbe der Karte. Kein Weichzeichner: Die Flaeche darunter
 * ist ohnehin leer.
 */
export function Laden() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          <div className="rose-tile grid h-16 w-16 place-items-center rounded-xl border border-ink-line bg-cream shadow-soft">
            <Rose className="h-8 w-8 bg-thema-aubergine" />
          </div>
          <div className="rose-tile grid h-16 w-16 place-items-center rounded-xl bg-thema-aubergine shadow-lift">
            <Rose className="h-8 w-8 bg-cream" />
          </div>
          <div className="rose-tile grid h-16 w-16 place-items-center rounded-xl border border-ink-line bg-cream shadow-soft">
            <Rose className="h-8 w-8 bg-thema-aubergine" />
          </div>
        </div>
        <p className="text-sm text-ink-soft">Karte wird geladen</p>
      </div>
    </div>
  );
}
