/**
 * Die Zeichen der Oberfläche.
 *
 * Bis September 2026 waren sie hier von Hand gezeichnet, auf einem Raster von
 * 16. Seit der Formsprache-Probe kommen sie aus Phosphor, wie in den
 * Geschwisterprojekten: ein Satz für alle Projekte wiegt schwerer als zwanzig
 * gesparte Kilobyte. Die Namen bleiben deutsch beziehungsweise wie gehabt,
 * damit die Aufrufstellen unverändert lesen.
 *
 * Zwei Zeichen bleiben von Hand gezeichnet, weil Phosphor sie nicht führt:
 * das Kontaktlos-Zeichen der Bezahlung und der Stern, der zu Teilen gefüllt
 * sein muss.
 */
import {
  BookOpen,
  Cardholder,
  Clock as PhClock,
  CreditCard,
  DeviceMobile,
  ForkKnife,
  Grains,
  House as PhHouse,
  Leaf as PhLeaf,
  Money,
  Pepper,
  Prohibit,
  QrCode as PhQrCode,
  ShoppingBag,
  SlidersHorizontal,
  Tag as PhTag,
  Truck as PhTruck,
  Umbrella as PhUmbrella,
  type Icon,
  type IconWeight,
} from "@phosphor-icons/react";

type Props = { className?: string; weight?: IconWeight };

/**
 * Ein Phosphor-Zeichen mit unserer Vorgabe: dekorativ, Gewicht `regular`. In
 * kleinen farbigen Flächen wird `bold` übergeben, sonst trägt der dünne Strich
 * auf drei Millimetern nicht.
 */
function zeichen(Ikon: Icon, standard = "h-4 w-4") {
  return function Zeichen({ className = standard, weight = "regular" }: Props) {
    return <Ikon className={className} weight={weight} aria-hidden />;
  };
}

export const Leaf = zeichen(PhLeaf, "h-3 w-3");
export const Chilli = zeichen(Pepper, "h-3 w-3");
export const House = zeichen(PhHouse);
export const Cutlery = zeichen(ForkKnife);
export const Sliders = zeichen(SlidersHorizontal);
export const Clock = zeichen(PhClock);
export const Wheat = zeichen(Grains);
export const Truck = zeichen(PhTruck);
export const Bag = zeichen(ShoppingBag);
export const Umbrella = zeichen(PhUmbrella);
export const Book = zeichen(BookOpen);
export const Card = zeichen(CreditCard);
export const CardChip = zeichen(Cardholder);
export const Cash = zeichen(Money);
export const Phone = zeichen(DeviceMobile);
export const QrCode = zeichen(PhQrCode);
export const Tag = zeichen(PhTag);
export const Verboten = zeichen(Prohibit, "h-3.5 w-3.5");

/**
 * Kontaktlos: Phosphor hat kein Zeichen dafür. Das Funkwellen-Symbol der
 * Kartenzahlung ist genormt und als solches erkennbar, ein Ersatz aus dem Satz
 * wäre eine andere Aussage.
 */
export function Contactless({ className = "h-4 w-4" }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        <path d="M5.5 5.5a4 4 0 0 1 0 5" />
        <path d="M8 3.5a7 7 0 0 1 0 9" />
        <path d="M10.5 1.8a10 10 0 0 1 0 12.4" />
      </g>
    </svg>
  );
}

/**
 * Der Stern der Herkunftsbewertung, zu einem Teil gefüllt. Phosphor kennt nur
 * ganz oder gar nicht; ein halber Stern wäre dort zwei übereinandergelegte
 * Zeichen mit einer Maske, also genau diese Zeichnung.
 */
export function Star({
  className = "h-3.5 w-3.5",
  fill = 1,
  id,
}: Props & { fill?: number; id: string }) {
  const d =
    "M8 1.6 9.9 5.5l4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6Z";
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={16 * fill} height="16" />
        </clipPath>
      </defs>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d={d} fill="currentColor" clipPath={`url(#${id})`} />
    </svg>
  );
}
