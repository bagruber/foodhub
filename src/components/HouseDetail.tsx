import { useMemo } from "react";
import { Herkunft } from "@/components/Herkunft";
import {
  Card,
  CardChip,
  Cash,
  Contactless,
  Phone,
  QrCode,
  Star,
  Tag,
} from "@/components/Icons";
import { Marks } from "@/components/Marks";
import {
  SOURCE_LABEL,
  formatPrice,
  type CityData,
  type Dish,
  type Provenance,
  type Restaurant,
  type Review,
} from "@/lib/data";
import { now } from "@/lib/filters";
import { WEEKDAY_LABEL, formatDay, isOpenAt, parseHours } from "@/lib/hours";

export function HouseDetail({
  house,
  dishes,
  loading,
  onClose,
  names,
}: {
  house: Restaurant;
  dishes: Dish[];
  loading: boolean;
  onClose: () => void;
  names: CityData;
}) {
  const sections = useMemo(() => {
    const grouped = new Map<string, Dish[]>();
    for (const d of dishes) grouped.set(d.section, [...(grouped.get(d.section) ?? []), d]);
    return [...grouped.entries()];
  }, [dishes]);

  const spans = parseHours(house.openingHours?.osm);
  const at = now();
  const open = spans ? isOpenAt(spans, at.day, at.minute) : null;

  const tags = [
    ...(house.kinds ?? []).map((k) => names.kinds[k] ?? k),
    ...house.cuisines.map((c) => names.cuisines[c] ?? c),
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-ink-line bg-cream px-4 py-3 lg:py-2.5">
        <button onClick={onClose} className="eyebrow hover:text-ink">
          ← zurück zur Liste
        </button>
        <h2 className="headline mt-1 text-xl lg:text-lg">{house.name}</h2>
        <p className="mt-1 text-sm text-ink-soft lg:mt-0.5 lg:text-xs">{tags.join(" · ")}</p>
      </div>

      <div className="space-y-5 px-4 py-4 lg:space-y-4 lg:py-3 lg:text-[0.9375rem]">
        {house.address?.street && (
          <p className="text-sm text-ink-soft">
            {house.address.street}
            {house.address.postalCode && `, ${house.address.postalCode} ${house.address.city}`}
          </p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {house.contact?.phone && (
            <a
              href={`tel:${house.contact.phone.replace(/\s/g, "")}`}
              className="underline decoration-ink-line underline-offset-2"
            >
              anrufen
            </a>
          )}
          {house.contact?.website && (
            <a
              href={house.contact.website}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-ink-line underline-offset-2"
            >
              Website
            </a>
          )}
          {house.ordering?.map((o) => (
            <a
              key={o.url}
              href={o.url}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white"
            >
              bestellen bei {o.provider}
            </a>
          ))}
          {house.osm && (
            <a
              href={`https://www.openstreetmap.org/${house.osm}`}
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted underline decoration-ink-line underline-offset-2"
            >
              in OpenStreetMap
            </a>
          )}
        </div>

        {(house.services || house.diet) && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {house.services?.delivery && <Badge>Lieferung</Badge>}
            {house.services?.takeaway && <Badge>zum Mitnehmen</Badge>}
            {house.services?.outdoorSeating && <Badge>Plätze draußen</Badge>}
            {house.services?.wheelchair === "yes" && <Badge>barrierefrei</Badge>}
            {house.services?.wheelchair === "limited" && <Badge>teils barrierefrei</Badge>}
            {house.diet?.vegetarian === "only" && <Badge>rein vegetarisch</Badge>}
            {house.diet?.vegetarian === "yes" && <Badge>vegetarische Gerichte</Badge>}
            {house.diet?.vegan === "yes" && <Badge>vegane Gerichte</Badge>}
          </div>
        )}

        {house.openingHours && (
          <section>
            <h3 className="eyebrow flex items-baseline gap-2">
              Öffnungszeiten
              {open !== null && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[0.65rem] normal-case tracking-normal ${
                    open ? "bg-diet-vegan/15 text-diet-vegan" : "bg-cream-dark text-ink-muted"
                  }`}
                >
                  {open ? "jetzt geöffnet" : "jetzt geschlossen"}
                </span>
              )}
            </h3>
            {spans ? (
              <table className="tabular mt-1.5 w-full text-sm">
                <tbody>
                  {WEEKDAY_LABEL.map((label, day) => (
                    <tr key={label} className={day === at.day ? "font-medium" : "text-ink-soft"}>
                      <td className="py-0.5 pr-3">{label}</td>
                      <td className="py-0.5">{formatDay(spans, day)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-1 text-sm">{house.openingHours.raw}</p>
            )}
            <Herkunft provenance={house.openingHours.provenance} className="mt-2" />
          </section>
        )}

        <Zahlung payment={house.payment} labels={names.payment} />
        <Bewertungen reviews={house.reviews} />

        {house.menuProvenance?.map((p, i) => (
          <section key={i}>
            <h3 className="eyebrow">Speisekarte</h3>
            <Herkunft provenance={p} className="mt-1.5" />
          </section>
        ))}

        {house.dishCount === 0 && (
          <p className="rounded-lg bg-cream-dark px-3 py-2.5 text-sm text-ink-soft">
            Für dieses Haus ist noch keine Speisekarte erfasst. Die Stammdaten stammen aus
            OpenStreetMap.
          </p>
        )}

        {loading && <p className="text-sm text-ink-muted">Gerichte werden geladen …</p>}

        {sections.map(([title, items]) => (
          <section key={title}>
            <h3 className="eyebrow border-b border-ink-line pb-1">{title}</h3>
            <ul className="mt-2 space-y-2.5 lg:mt-1.5 lg:space-y-2">
              {items.map((d, i) => (
                <li key={`${d.ref ?? i}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    {/* `min-w-0`, sonst wächst ein langer Gerichtsname über
                        die Spalte hinaus statt umzubrechen: Flexkinder dürfen
                        von sich aus nicht unter ihre Inhaltsbreite. */}
                    <span className="min-w-0 text-sm font-medium">
                      {d.ref && <span className="tabular text-ink-muted">{d.ref} </span>}
                      {d.name}
                    </span>
                    {/* Nur kurze Preise stehen neben dem Namen. Trägt einer
                        eine Anmerkung — beim Woch'nblatt `17,90 € mit 6
                        Frischkäse-Gemüse-Röstibällchen` — steht er darunter,
                        sonst schöbe er die Spalte auf das Doppelte. */}
                    {!noted(d) && (
                      <span className="tabular shrink-0 text-sm text-ink-soft">
                        {d.prices.map(formatPrice).join(" · ")}
                      </span>
                    )}
                  </div>
                  {noted(d) && (
                    <ul className="tabular mt-0.5 space-y-0.5 text-xs text-ink-soft">
                      {d.prices.map((price, n) => (
                        <li key={n}>{formatPrice(price)}</li>
                      ))}
                    </ul>
                  )}
                  {d.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{d.description}</p>
                  )}
                  <div className="mt-1">
                    <Marks dish={d} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Ob ein Preis eine Anmerkung trägt und deshalb eine eigene Zeile braucht. */
function noted(dish: Dish): boolean {
  return dish.prices.some((p) => p.note);
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-cream-dark px-1.5 py-0.5 text-ink-soft">{children}</span>
  );
}

/**
 * Womit man zahlen kann, und womit ausdrücklich nicht.
 *
 * Das Nein steht mit dabei, weil es die nützlichere Hälfte ist: dass ein Haus
 * keine Karte nimmt, entscheidet darüber, ob jemand vorher zum Automaten muss.
 * Was gar nicht dasteht, ist unbekannt und wird auch nicht erraten.
 */
/**
 * Ein Zeichen je Zahlungsart.
 *
 * Karte ist nicht gleich Karte, und genau da liegt der praktische Unterschied:
 * viele Wirtshäuser nehmen die Girocard und keine Kreditkarte. Zwei Wörter
 * nebeneinander liest niemand, zwei Zeichen unterscheidet man auf einen Blick,
 * deshalb trägt die Kreditkarte den Chip und die Girocard den Magnetstreifen.
 */
const PAYMENT_ICON: Record<string, (p: { className?: string }) => React.ReactNode> = {
  cash: Cash,
  cards: Card,
  debit_cards: Card,
  credit_cards: CardChip,
  contactless: Contactless,
  mobile: Phone,
  qr_code: QrCode,
  moosburg_card: Tag,
};

function Zahlung({
  payment,
  labels,
}: {
  payment?: Record<string, { accepted: boolean; provenance: Provenance }>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(payment ?? {});
  if (!entries.length) return null;
  const yes = entries.filter(([, c]) => c.accepted);
  const no = entries.filter(([, c]) => !c.accepted);

  // Je Quelle eine Herkunftszeile. Die Kartenfelder kommen aus OSM, die
  // MoosburgCard von der Liste der Akzeptanzstellen.
  const sources = new Map<string, Provenance>();
  for (const [, claim] of entries) {
    sources.set(`${claim.provenance.kind}|${claim.provenance.url ?? ""}`, claim.provenance);
  }

  return (
    <section>
      <h3 className="eyebrow">Zahlung</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
        {yes.map(([slug]) => {
          const Icon = PAYMENT_ICON[slug];
          return (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded bg-diet-vegan/12 px-1.5 py-0.5 text-diet-vegan"
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {labels[slug] ?? slug}
            </span>
          );
        })}
        {no.map(([slug]) => {
          const Icon = PAYMENT_ICON[slug];
          return (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded border border-dashed border-ink-line px-1.5 py-0.5 text-ink-muted line-through decoration-ink-muted/60"
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {labels[slug] ?? slug}
            </span>
          );
        })}
      </div>
      <div className="mt-2 space-y-0.5">
        {[...sources.values()].map((p, i) => (
          <Herkunft key={i} provenance={p} kurz />
        ))}
      </div>
    </section>
  );
}

/**
 * Bewertungen anderer Portale.
 *
 * Fremde Meinungen, unter fremdem Namen erhoben. Der Hinweis darunter ist
 * keine Höflichkeit: die Zahl steht neben unserer eigenen Auskunft und wäre
 * sonst von ihr nicht zu unterscheiden.
 */
/**
 * Fünf Sterne, der letzte anteilig gefüllt.
 *
 * Eine Zahl allein liest sich nicht schnell genug: `2,2` und `4,3` stehen
 * gleich breit da und sehen gleich aus. Die Skala steht trotzdem daneben, denn
 * die Sterne sagen nicht, worauf sie sich beziehen.
 *
 * Die Kennung der Schnittmaske trägt die Quelle im Namen. Zwei Sternreihen auf
 * einer Seite hätten sonst dieselbe `id`, und im SVG gewinnt die erste.
 */
function Sterne({ value, scale, source }: { value: number; scale: number; source: string }) {
  const filled = (value / scale) * 5;
  return (
    <span className="flex text-spice" title={`${value} von ${scale}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} id={`stern-${source}-${i}`} fill={Math.max(0, Math.min(1, filled - i))} />
      ))}
    </span>
  );
}

function Bewertungen({ reviews }: { reviews?: Review[] }) {
  if (!reviews?.length) return null;
  return (
    <section>
      <h3 className="eyebrow">Bewertungen anderswo</h3>
      <ul className="mt-1.5 space-y-1.5 text-sm">
        {reviews.map((r) => (
          <li key={r.source} className="flex items-center justify-between gap-3">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer nofollow"
              className="underline decoration-ink-line underline-offset-2 hover:decoration-ink"
            >
              {SOURCE_LABEL[r.source]}
            </a>
            {r.rating ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <Sterne value={r.rating.value} scale={r.rating.scale} source={r.source} />
                <span className="tabular text-ink-soft">
                  {r.rating.value.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                </span>
                {r.rating.count !== undefined && (
                  <span className="tabular text-xs text-ink-muted">({r.rating.count})</span>
                )}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-ink-muted">nur Link</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Fremde Bewertungen, mit Quelle und Abrufdatum weitergegeben. Für ihren Inhalt sind die
        jeweiligen Portale und ihre Verfasser verantwortlich, nicht diese Seite.
      </p>
      <div className="mt-2 space-y-0.5">
        {reviews.map((r) => (
          <Herkunft key={r.source} provenance={r.provenance} kurz />
        ))}
      </div>
    </section>
  );
}
