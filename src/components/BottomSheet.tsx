import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Das Blatt über der Karte, in drei Rastungen.
 *
 * Der wunde Punkt eines solchen Blatts ist der Streit zwischen Ziehen und
 * Scrollen: beides ist dieselbe Geste nach oben oder unten. Die Regel folgt
 * der aus Google Maps, weil die den meisten schon in den Fingern sitzt.
 *
 *   Griff angefasst              -> immer ziehen
 *   unterste Rastung             -> immer ziehen, es gibt noch keine Liste
 *   Liste angefasst, ganz oben   -> nach unten ziehen bewegt das Blatt
 *   Liste angefasst, gescrollt   -> die Liste scrollt, das Blatt bleibt
 *
 * In der untersten Rastung ist die Liste gar nicht da. Das ist der Punkt: dort
 * gehört die Fläche der Karte, und eine halb abgeschnittene Liste am unteren
 * Rand nützt niemandem. Sichtbar bleiben Suche und Filter, und beide holen das
 * Blatt beim Antippen selbst nach oben.
 *
 * `touch-action: none` steht deshalb nur dort, wo gezogen wird. In der Liste
 * bleibt das native Scrollen unangetastet, samt Schwung und Randverhalten des
 * Systems.
 */

export type Detent = "peek" | "half" | "full";

/** Anteil der Fensterhöhe, den das Blatt in dieser Rastung freigibt. */
const HEIGHT: Record<Detent, string> = {
  peek: "var(--sheet-peek)",
  half: "52dvh",
  full: "calc(100dvh - 4.5rem)",
};

const ORDER: Detent[] = ["peek", "half", "full"];

/** Woran die Geste begonnen hat. Davon haengt ab, ob sie ziehen darf. */
type Source = "handle" | "head" | "list";

/** Übliche Schwelle, ab der eine Wischgeste als gewollt gilt. */
const THRESHOLD = 48;

type Props = {
  detent: Detent;
  onDetent: (d: Detent) => void;
  /** Bleibt in jeder Rastung sichtbar: Umschalter, Suche, Filterreihe. */
  head: ReactNode;
  children: ReactNode;
};

export function BottomSheet({ detent, onDetent, head, children }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef({ y: 0, source: "handle" as Source });
  const closed = detent === "peek";

  // Waehrend gezogen wird, folgt das Blatt dem Finger ohne Uebergang.
  const style = {
    height: HEIGHT[detent],
    transform: drag ? `translateY(${drag}px)` : undefined,
    transition: drag === null ? "height 260ms cubic-bezier(0.32,0.72,0,1), transform 260ms" : "none",
  };

  function begin(event: React.PointerEvent, source: Source) {
    // Aus der Liste heraus zieht nur, wer schon ganz oben steht. Sonst wuerde
    // jeder Scrollversuch das Blatt zuklappen.
    if (source === "list" && (scroller.current?.scrollTop ?? 0) > 0) return;
    // Im Kopf zieht nur die freie Flaeche. Wer die Suche antippt, will tippen,
    // wer einen Filter antippt, will ihn setzen. Am Griff gilt das nicht: er
    // ist selbst ein Knopf und muss trotzdem ziehen.
    if (source === "head" && (event.target as Element).closest?.("input, button, a, label")) return;
    start.current = { y: event.clientY, source };
    setDrag(0);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function move(event: React.PointerEvent) {
    if (drag === null) return;
    const delta = event.clientY - start.current.y;
    // Aus der Liste heraus nur nach unten. Nach oben soll sie scrollen.
    if (start.current.source === "list" && delta < 0) {
      setDrag(null);
      return;
    }
    setDrag(delta);
  }

  function end() {
    if (drag === null) return;
    const index = ORDER.indexOf(detent);
    const step = drag > THRESHOLD ? -1 : drag < -THRESHOLD ? 1 : 0;
    const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, index + step))];
    setDrag(null);
    if (next !== detent) onDetent(next);
  }

  // Beim Zuklappen nach oben scrollen, sonst zeigt die Liste beim naechsten
  // Aufklappen ihre Mitte.
  useEffect(() => {
    if (closed && scroller.current) scroller.current.scrollTop = 0;
  }, [closed]);

  const dragHandlers = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  };

  return (
    <div
      style={style}
      className="pointer-events-auto flex flex-col rounded-t-2xl border-t border-ink-line bg-cream shadow-[0_-8px_24px_rgba(28,28,28,0.12)]"
    >
      <div
        onPointerDown={(e) => begin(e, "handle")}
        {...dragHandlers}
        className="shrink-0 cursor-grab touch-none px-4 pt-2 pb-1 active:cursor-grabbing"
      >
        <button
          onClick={() => onDetent(closed ? "half" : "peek")}
          aria-label={closed ? "Liste zeigen" : "Liste einklappen"}
          className="mx-auto block h-1.5 w-10 rounded-full bg-ink-line"
        />
      </div>

      {/* In der untersten Rastung zieht auch der Kopf, denn darunter liegt
          keine Liste, die scrollen könnte. */}
      <div
        onPointerDown={closed ? (e) => begin(e, "head") : undefined}
        {...(closed ? dragHandlers : {})}
        className={`shrink-0 px-4 pb-2 ${closed ? "touch-pan-x" : ""}`}
      >
        {head}
      </div>

      <div
        ref={scroller}
        onPointerDown={(e) => begin(e, "list")}
        {...dragHandlers}
        hidden={closed}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
    </div>
  );
}
