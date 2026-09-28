import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  Bug,
  CaretDown,
  Code,
  Envelope,
  Scroll,
  X,
} from "@phosphor-icons/react";

const DATA_HUB = "https://moosburg.eu/data/";

/** CSS-Maske fuer eine Datei unter public/, damit die Form eine Token-Farbe annimmt. */
function maske(datei: string): CSSProperties {
  const url = `url(${import.meta.env.BASE_URL}${datei})`;
  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
}

/** Die Moosburger Rose, gefaerbt ueber die Hintergrundklasse (etwa bg-gold-200). */
export function Rose({ className }: { className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 ${className ?? ""}`} style={maske("logo.svg")} />;
}

function Stripe() {
  return (
    <div className="flex h-1 w-full shrink-0" aria-hidden>
      <span className="flex-1 bg-rb-1" />
      <span className="flex-1 bg-rb-2" />
      <span className="flex-1 bg-rb-3" />
      <span className="flex-1 bg-rb-4" />
      <span className="flex-1 bg-rb-5" />
      <span className="flex-1 bg-rb-6" />
      <span className="flex-1 bg-rb-7" />
      <span className="flex-1 bg-rb-8" />
      <span className="flex-1 bg-rb-9" />
    </div>
  );
}

/**
 * Stripe und Band als einzige Kopfzeile der Karte (Formsprache-Probe,
 * Punkt 1 bis 3). Das Band traegt die Themenfarbe der Karte; der Titel steht
 * hier und nicht mehr im Blatt.
 *
 * Die Kennzahl erscheint erst, wenn die Karte steht. Vorher stuende dort eine
 * Zahl ueber einer leeren Flaeche.
 */
export function Kopf({
  titel,
  zahl,
  einheit,
  zeigeKennzahl,
  laedtNach,
  panel,
}: {
  titel: string;
  zahl: string;
  einheit: string;
  zeigeKennzahl: boolean;
  laedtNach?: string;
  panel: ReactNode;
}) {
  return (
    <header className="relative z-30 shrink-0">
      <Stripe />
      <div className="flex h-[60px] items-center gap-1 bg-thema-aubergine px-1.5 lg:h-[52px] lg:gap-4 lg:px-5">
        <a
          href={DATA_HUB}
          className="grid h-11 w-11 shrink-0 place-items-center text-cream/85 hover:text-cream lg:flex lg:h-auto lg:w-auto lg:items-center lg:gap-1.5 lg:text-[15px]"
        >
          <ArrowLeft size={22} weight="bold" aria-hidden className="lg:hidden" />
          <ArrowLeft size={15} aria-hidden className="hidden lg:block" />
          <span className="sr-only lg:not-sr-only lg:whitespace-nowrap">Data Hub</span>
        </a>

        <span aria-hidden className="hidden h-[26px] w-px shrink-0 bg-cream/28 lg:block" />

        <div className="flex min-w-0 flex-col lg:flex-row lg:items-center lg:gap-4">
          <h1 className="truncate font-display text-[20px] font-semibold leading-none text-cream lg:text-[23px]">
            {titel}
          </h1>
          <p className="mt-1 h-[15px] text-[12.5px] leading-none text-cream/82 lg:mt-0 lg:h-auto lg:text-[14px]">
            {laedtNach ? (
              <span className="flex items-center gap-1.5">
                <Rose className="rose-spin h-[14px] w-[14px] bg-gold-200" />
                {laedtNach}
              </span>
            ) : zeigeKennzahl ? (
              <>
                <b className="font-display text-[13.5px] font-semibold tabular-nums lining-nums text-gold-200 lg:text-[17px]">
                  {zahl}
                </b>{" "}
                {einheit}
              </>
            ) : null}
          </p>
        </div>

        <div className="ml-auto shrink-0">
          <UeberDasProjekt>{panel}</UeberDasProjekt>
        </div>
      </div>
    </header>
  );
}

const linkZeile = "flex items-center gap-3 rounded-md px-2 py-2 text-[15px] hover:bg-cream-dark";

/**
 * Disclosure wie im Data Hub: Knopf mit aria-expanded, Esc und Klick ausserhalb
 * schliessen, der Fokus kehrt zum Knopf zurueck. Ab lg haengt das Panel unter
 * dem Knopf, darunter kommt es als Blatt von unten.
 */
function UeberDasProjekt({ children }: { children: ReactNode }) {
  const [offen, setOffen] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const bereich = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffen(false);
        knopf.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!bereich.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [offen]);

  return (
    <div ref={bereich} className="relative">
      <button
        ref={knopf}
        type="button"
        aria-expanded={offen}
        aria-controls={panelId}
        onClick={() => setOffen((o) => !o)}
        className="grid h-11 w-11 place-items-center rounded-xl text-cream/90 hover:bg-cream/10 lg:flex lg:h-9 lg:w-auto lg:items-center lg:gap-2 lg:px-2 lg:text-[15px]"
      >
        <Rose className="h-[26px] w-[26px] bg-gold-200 lg:h-5 lg:w-5" />
        <span className="sr-only lg:not-sr-only lg:whitespace-nowrap">Über das Projekt</span>
        <CaretDown
          size={14}
          aria-hidden
          className={`hidden lg:block ${offen ? "rotate-180" : ""}`}
        />
      </button>

      {offen && (
        <>
          <div aria-hidden className="fixed inset-0 z-40 bg-ink/20 lg:hidden" onClick={() => setOffen(false)} />
          <div
            id={panelId}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-ink-line bg-cream p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lift lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-full lg:mt-2 lg:w-96 lg:rounded-xl lg:pb-5"
          >
            <div className="flex items-start justify-between gap-3">
              <a
                href="https://moosburg.eu/"
                className={`${linkZeile} -ml-2 font-semibold text-red-700`}
              >
                <Rose className="h-[18px] w-[18px] bg-red-700" />
                moosburg.eu, alle Projekte
              </a>
              <button
                type="button"
                onClick={() => {
                  setOffen(false);
                  knopf.current?.focus();
                }}
                aria-label="Schließen"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-cream-dark lg:hidden"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/** Inhalt des Panels: Name, ein Satz, Hinweis, dann die vier festen Wege. */
export function PanelInhalt({
  name,
  satz,
  repo,
}: {
  name: string;
  satz: string;
  repo: string;
}) {
  return (
    <>
      <p className="mt-3 font-display text-lg font-semibold">{name}</p>
      <p className="mt-1 text-sm text-ink-soft">{satz}</p>
      <p className="mt-3 rounded-md bg-cream-dark px-3 py-2 text-sm text-ink-soft">
        Privates Projekt, kein Auftritt der Stadt. Verbindlich sind die jeweiligen Quellen.
      </p>
      <ul className="mt-3">
        <li>
          <a href="https://moosburg.eu/data/about" className={linkZeile}>
            <Scroll size={18} aria-hidden className="text-ink-muted" />
            Über die Daten
          </a>
        </li>
        <li>
          <a href="https://moosburg.eu/#impressum" className={linkZeile}>
            <Envelope size={18} aria-hidden className="text-ink-muted" />
            Impressum und Kontakt
          </a>
        </li>
        <li>
          <a href={`${repo}/issues`} target="_blank" rel="noreferrer" className={linkZeile}>
            <Bug size={18} aria-hidden className="text-ink-muted" />
            Fehler melden
            <ArrowSquareOut size={14} aria-hidden className="text-ink-muted" />
          </a>
        </li>
        <li>
          <a href={repo} target="_blank" rel="noreferrer" className={linkZeile}>
            <Code size={18} aria-hidden className="text-ink-muted" />
            Quellcode
            <ArrowSquareOut size={14} aria-hidden className="text-ink-muted" />
          </a>
        </li>
      </ul>
    </>
  );
}
