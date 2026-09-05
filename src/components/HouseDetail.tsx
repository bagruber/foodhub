import { useMemo } from "react";
import { Herkunft } from "@/components/Herkunft";
import { Marks } from "@/components/Marks";
import { formatPrice, type CityData, type Dish, type Restaurant } from "@/lib/data";
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
      <div className="sticky top-0 z-10 border-b border-ink-line bg-cream px-4 py-3">
        <button onClick={onClose} className="eyebrow hover:text-ink">
          ← zurück zur Liste
        </button>
        <h2 className="headline mt-1 text-xl">{house.name}</h2>
        <p className="mt-1 text-sm text-ink-soft">{tags.join(" · ")}</p>
      </div>

      <div className="space-y-5 px-4 py-4">
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
            <ul className="mt-2 space-y-2.5">
              {items.map((d, i) => (
                <li key={`${d.ref ?? i}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {d.ref && <span className="tabular text-ink-muted">{d.ref} </span>}
                      {d.name}
                    </span>
                    <span className="tabular shrink-0 text-sm text-ink-soft">
                      {d.prices.map(formatPrice).join(" · ")}
                    </span>
                  </div>
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-cream-dark px-1.5 py-0.5 text-ink-soft">{children}</span>
  );
}
