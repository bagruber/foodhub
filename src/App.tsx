import { useEffect, useMemo, useState } from "react";
import { CityMap } from "@/components/CityMap";
import { Herkunft } from "@/components/Herkunft";
import {
  formatPrice,
  loadCity,
  loadDishes,
  lowestPrice,
  type CityData,
  type Dish,
  type DishData,
  type Restaurant,
} from "@/lib/data";

const CITY = "moosburg";

type Mode = "houses" | "dishes";
type Diet = "vegetarian" | "vegan" | null;

export function App() {
  const [city, setCity] = useState<CityData | null>(null);
  const [dishData, setDishData] = useState<DishData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("houses");
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [onlyWithMenu, setOnlyWithMenu] = useState(false);
  const [diet, setDiet] = useState<Diet>(null);
  const [spicy, setSpicy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    loadCity(CITY).then(setCity).catch((e) => setError(String(e)));
  }, []);

  // Die Gerichte kommen erst, wenn jemand sie braucht. Die Karte soll nicht
  // auf 120 kB warten, die die meisten Besucher nie öffnen.
  useEffect(() => {
    if (mode !== "dishes" || dishData) return;
    loadDishes(CITY).then(setDishData).catch((e) => setError(String(e)));
  }, [mode, dishData]);

  const houses = city?.restaurants ?? [];
  const byId = useMemo(() => new Map(houses.map((h) => [h.id, h])), [houses]);

  // Nur Küchen anbieten, die hier auch vorkommen, häufigste zuerst. Das
  // Vokabular führt 37, in Moosburg belegt sind gut zwanzig.
  const cuisineOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of houses) for (const c of h.cuisines) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [houses]);

  const visibleHouses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return houses
      .filter((h) => !onlyWithMenu || h.dishCount > 0)
      .filter((h) => !cuisine || h.cuisines.includes(cuisine))
      .filter((h) => !needle || h.name.toLowerCase().includes(needle))
      .sort((a, b) => b.dishCount - a.dishCount || a.name.localeCompare(b.name, "de"));
  }, [houses, query, cuisine, onlyWithMenu]);

  const visibleDishes = useMemo(() => {
    if (!dishData) return [];
    const needle = query.trim().toLowerCase();
    return dishData.dishes
      .filter((d) => !diet || d.diet[diet])
      .filter((d) => !spicy || (d.spice?.level ?? 0) > 0)
      .filter((d) => !cuisine || byId.get(d.restaurantId)?.cuisines.includes(cuisine))
      .filter(
        (d) =>
          !needle ||
          d.name.toLowerCase().includes(needle) ||
          (d.description ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => (lowestPrice(a) ?? 1e9) - (lowestPrice(b) ?? 1e9));
  }, [dishData, query, cuisine, diet, spicy, byId]);

  // Die Karte zeigt, was die Filter übrig lassen. Im Gerichtsmodus sind das
  // die Häuser, in denen ein passendes Gericht steht.
  const onMap = useMemo(() => {
    if (mode === "houses") return visibleHouses;
    const ids = new Set(visibleDishes.map((d) => d.restaurantId));
    return houses.filter((h) => ids.has(h.id));
  }, [mode, visibleHouses, visibleDishes, houses]);

  const detail = selected ? byId.get(selected) : null;

  if (error) return <Notice>Die Daten ließen sich nicht laden. {error}</Notice>;
  if (!city) return <Notice>Wird geladen …</Notice>;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden lg:flex-row-reverse">
      <div className="h-[38vh] w-full min-w-0 shrink-0 overflow-hidden border-b border-ink-line lg:h-full lg:w-auto lg:flex-1 lg:border-b-0 lg:border-l">
        <CityMap
          restaurants={onMap}
          center={city.city.center}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:w-[27rem] lg:max-w-[27rem] lg:flex-none">
        <header className="border-b border-ink-line px-4 pt-4 pb-3">
          <p className="eyebrow">{city.city.name}</p>
          <h1 className="headline mt-0.5 text-[1.6rem]">Was gibt es zu essen</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {houses.length} Häuser, {houses.filter((h) => h.dishCount > 0).length} davon mit
            eingelesener Speisekarte. Jede Angabe nennt ihre Quelle und ihr Alter.
          </p>
        </header>

        {detail ? (
          <HouseDetail
            house={detail}
            dishes={dishData?.dishes.filter((d) => d.restaurantId === detail.id) ?? []}
            loading={detail.dishCount > 0 && !dishData}
            onLoadDishes={() => setMode("dishes")}
            onClose={() => setSelected(null)}
            cuisineNames={city.cuisines}
          />
        ) : (
          <>
            <Controls
              mode={mode}
              setMode={setMode}
              query={query}
              setQuery={setQuery}
              cuisine={cuisine}
              setCuisine={setCuisine}
              cuisineOptions={cuisineOptions}
              cuisineNames={city.cuisines}
              onlyWithMenu={onlyWithMenu}
              setOnlyWithMenu={setOnlyWithMenu}
              diet={diet}
              setDiet={setDiet}
              spicy={spicy}
              setSpicy={setSpicy}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {mode === "houses" ? (
                <HouseList
                  houses={visibleHouses}
                  cuisineNames={city.cuisines}
                  onSelect={setSelected}
                />
              ) : dishData ? (
                <DishList dishes={visibleDishes} byId={byId} onSelect={setSelected} />
              ) : (
                <p className="px-4 py-6 text-sm text-ink-muted">Gerichte werden geladen …</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-8 text-sm text-ink-soft">{children}</div>;
}

type ControlProps = {
  mode: Mode;
  setMode: (m: Mode) => void;
  query: string;
  setQuery: (q: string) => void;
  cuisine: string | null;
  setCuisine: (c: string | null) => void;
  cuisineOptions: [string, number][];
  cuisineNames: Record<string, string>;
  onlyWithMenu: boolean;
  setOnlyWithMenu: (v: boolean) => void;
  diet: Diet;
  setDiet: (d: Diet) => void;
  spicy: boolean;
  setSpicy: (v: boolean) => void;
};

function Controls(p: ControlProps) {
  return (
    <div className="space-y-3 border-b border-ink-line px-4 py-3">
      <div className="flex gap-1 rounded-lg bg-cream-dark p-1 text-sm">
        {(["houses", "dishes"] as const).map((m) => (
          <button
            key={m}
            onClick={() => p.setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
              p.mode === m ? "bg-cream text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "houses" ? "Häuser" : "Gerichte"}
          </button>
        ))}
      </div>

      <input
        value={p.query}
        onChange={(e) => p.setQuery(e.target.value)}
        placeholder={p.mode === "houses" ? "Haus suchen" : "Gericht oder Zutat suchen"}
        className="w-full rounded-lg border border-ink-line bg-cream px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-ink-muted"
      />

      {p.mode === "houses" ? (
        <Toggle
          active={p.onlyWithMenu}
          onClick={() => p.setOnlyWithMenu(!p.onlyWithMenu)}
          label="nur mit Speisekarte"
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Toggle
            active={p.diet === "vegetarian"}
            onClick={() => p.setDiet(p.diet === "vegetarian" ? null : "vegetarian")}
            label="vegetarisch"
          />
          <Toggle
            active={p.diet === "vegan"}
            onClick={() => p.setDiet(p.diet === "vegan" ? null : "vegan")}
            label="vegan"
          />
          <Toggle active={p.spicy} onClick={() => p.setSpicy(!p.spicy)} label="scharf" />
        </div>
      )}

      <CuisineFilter
        options={p.cuisineOptions}
        names={p.cuisineNames}
        active={p.cuisine}
        onPick={(slug) => p.setCuisine(p.cuisine === slug ? null : slug)}
      />
    </div>
  );
}

/**
 * Die Küchenfilter, gekürzt.
 *
 * Moosburg belegt 28 Küchen, und alle als Chips ausgelegt füllten den halben
 * Bildschirm, bevor das erste Haus zu sehen war. Sichtbar bleiben die
 * häufigsten acht, der Rest auf Wunsch. Eine ausgewählte Küche rutscht immer
 * nach vorn, damit sie nicht im eingeklappten Teil verschwindet.
 */
function CuisineFilter({
  options,
  names,
  active,
  onPick,
}: {
  options: [string, number][];
  names: Record<string, string>;
  active: string | null;
  onPick: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ordered = useMemo(
    () => [...options].sort((a, b) => Number(b[0] === active) - Number(a[0] === active)),
    [options, active],
  );
  const shown = expanded ? ordered : ordered.slice(0, 8);
  const hidden = ordered.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(([slug, count]) => (
        <Toggle
          key={slug}
          active={active === slug}
          onClick={() => onPick(slug)}
          label={`${names[slug] ?? slug} ${count}`}
        />
      ))}
      {(hidden > 0 || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-full px-2.5 py-1 text-xs text-ink-muted underline decoration-ink-line underline-offset-2 hover:text-ink"
        >
          {expanded ? "weniger" : `${hidden} weitere`}
        </button>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-red-500 bg-red-500 text-white"
          : "border-ink-line bg-cream text-ink-soft hover:border-ink-muted"
      }`}
    >
      {label}
    </button>
  );
}

function HouseList({
  houses,
  cuisineNames,
  onSelect,
}: {
  houses: Restaurant[];
  cuisineNames: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  if (!houses.length) return <Empty />;
  return (
    <ul className="divide-y divide-ink-line">
      {houses.map((h) => (
        <li key={h.id}>
          <button
            onClick={() => onSelect(h.id)}
            className="w-full px-4 py-3 text-left hover:bg-cream-dark"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{h.name}</span>
              {h.dishCount > 0 && (
                <span className="tabular shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  {h.dishCount} Gerichte
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">
              {h.cuisines.map((c) => cuisineNames[c] ?? c).join(" · ") || "ohne Angabe"}
              {h.address?.street && <> · {h.address.street}</>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DishList({
  dishes,
  byId,
  onSelect,
}: {
  dishes: Dish[];
  byId: Map<string, Restaurant>;
  onSelect: (id: string) => void;
}) {
  if (!dishes.length) return <Empty />;
  return (
    <ul className="divide-y divide-ink-line">
      {dishes.slice(0, 300).map((d, i) => (
        <li key={`${d.restaurantId}-${d.ref ?? i}`} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{d.name}</span>
            <span className="tabular shrink-0 text-sm text-ink-soft">
              {d.prices.map(formatPrice).join(" · ") || "ohne Preis"}
            </span>
          </div>
          {d.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{d.description}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => onSelect(d.restaurantId)}
              className="underline decoration-ink-line underline-offset-2 hover:decoration-ink"
            >
              {byId.get(d.restaurantId)?.name ?? d.restaurantId}
            </button>
            <span className="text-ink-muted">· {d.section}</span>
            <DishTags dish={d} />
          </div>
        </li>
      ))}
      {dishes.length > 300 && (
        <li className="px-4 py-3 text-xs text-ink-muted">
          {dishes.length - 300} weitere, bitte die Suche einengen.
        </li>
      )}
    </ul>
  );
}

/**
 * Merkmale am Gericht. `inferred` wird eigens ausgewiesen: bei Ernährungsform
 * und Allergenen ist der Unterschied zwischen gedruckt und geschlossen keine
 * Feinheit, sondern der ganze Punkt.
 */
function DishTags({ dish }: { dish: Dish }) {
  const tags: string[] = [];
  if (dish.diet.vegan) tags.push(dish.diet.vegan === "declared" ? "vegan" : "vegan?");
  else if (dish.diet.vegetarian)
    tags.push(dish.diet.vegetarian === "declared" ? "vegetarisch" : "vegetarisch?");
  if (dish.spice) tags.push("🌶".repeat(Math.max(1, dish.spice.level)));
  if (!tags.length) return null;
  return (
    <>
      {tags.map((t) => (
        <span key={t} className="rounded bg-cream-dark px-1.5 py-0.5 text-ink-soft">
          {t}
        </span>
      ))}
    </>
  );
}

function Empty() {
  return <p className="px-4 py-6 text-sm text-ink-muted">Dazu findet sich nichts.</p>;
}

function HouseDetail({
  house,
  dishes,
  loading,
  onLoadDishes,
  onClose,
  cuisineNames,
}: {
  house: Restaurant;
  dishes: Dish[];
  loading: boolean;
  onLoadDishes: () => void;
  onClose: () => void;
  cuisineNames: Record<string, string>;
}) {
  const sections = useMemo(() => {
    const grouped = new Map<string, Dish[]>();
    for (const d of dishes) grouped.set(d.section, [...(grouped.get(d.section) ?? []), d]);
    return [...grouped.entries()];
  }, [dishes]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 border-b border-ink-line bg-cream px-4 py-3">
        <button onClick={onClose} className="eyebrow hover:text-ink">
          ← zurück zur Liste
        </button>
        <h2 className="headline mt-1 text-xl">{house.name}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {house.cuisines.map((c) => cuisineNames[c] ?? c).join(" · ")}
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        {house.address?.street && (
          <p className="text-sm text-ink-soft">
            {house.address.street}, {house.address.postalCode} {house.address.city}
          </p>
        )}
        {house.contact?.phone && (
          <p className="text-sm">
            <a href={`tel:${house.contact.phone.replace(/\s/g, "")}`} className="underline decoration-ink-line underline-offset-2">
              {house.contact.phone}
            </a>
            {house.contact.website && (
              <>
                {" · "}
                <a
                  href={house.contact.website}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-ink-line underline-offset-2"
                >
                  Website
                </a>
              </>
            )}
          </p>
        )}

        {house.openingHours && (
          <section>
            <h3 className="eyebrow">Öffnungszeiten</h3>
            <p className="tabular mt-1 text-sm">{house.openingHours.raw}</p>
            <Herkunft provenance={house.openingHours.provenance} className="mt-1.5" />
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
        {house.dishCount > 0 && !dishes.length && !loading && (
          <button onClick={onLoadDishes} className="text-sm underline underline-offset-2">
            {house.dishCount} Gerichte anzeigen
          </button>
        )}

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
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <DishTags dish={d} />
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
