import { useEffect, useMemo, useState } from "react";
import { BottomSheet, type Detent } from "@/components/BottomSheet";
import { CityMap } from "@/components/CityMap";
import { Chip, FilterSheet } from "@/components/FilterSheet";
import { HouseDetail } from "@/components/HouseDetail";
import { Marks } from "@/components/Marks";
import {
  formatPrice,
  loadCity,
  loadDishes,
  type CityData,
  type Dish,
  type DishData,
  type Restaurant,
} from "@/lib/data";
import { EMPTY, countActive, matchesDish, matchesHouse, now, type Filters } from "@/lib/filters";
import { groupDishes, sortByPrice, type DishGroup } from "@/lib/group";
import { clock } from "@/lib/hours";

const CITY = "moosburg";

type Mode = "houses" | "dishes";

export function App() {
  const [city, setCity] = useState<CityData | null>(null);
  const [dishData, setDishData] = useState<DishData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("houses");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detent, setDetent] = useState<Detent>("half");

  useEffect(() => {
    loadCity(CITY).then(setCity).catch((e) => setError(String(e)));
  }, []);

  // Die Gerichte kommen erst, wenn jemand sie braucht. Die Karte soll nicht
  // auf 120 kB warten, die die meisten Besucher nie öffnen. Ein geöffnetes
  // Haus mit Speisekarte braucht sie auch.
  const needDishes = mode === "dishes" || filters.without.length > 0 || !!selected;
  useEffect(() => {
    if (!needDishes || dishData) return;
    loadDishes(CITY).then(setDishData).catch((e) => setError(String(e)));
  }, [needDishes, dishData]);

  const houses = city?.restaurants ?? [];
  const byId = useMemo(() => new Map(houses.map((h) => [h.id, h])), [houses]);

  const available = useMemo(
    () => ({
      kinds: new Set(houses.flatMap((h) => h.kinds ?? [])),
      cuisines: new Set(houses.flatMap((h) => h.cuisines)),
    }),
    [houses],
  );

  const visibleHouses = useMemo(
    () =>
      houses
        .filter((h) => matchesHouse(h, filters))
        .sort((a, b) => b.dishCount - a.dishCount || a.name.localeCompare(b.name, "de")),
    [houses, filters],
  );

  const visibleGroups = useMemo(() => {
    if (!dishData) return [];
    const hits = dishData.dishes.filter((d) =>
      matchesDish(d, filters, byId.get(d.restaurantId)),
    );
    return sortByPrice(groupDishes(hits));
  }, [dishData, filters, byId]);

  // Die Karte zeigt, was die Filter übrig lassen. Im Gerichtsmodus sind das
  // die Häuser, in denen ein passendes Gericht steht.
  const onMap = useMemo(() => {
    if (mode === "houses") return visibleHouses;
    const ids = new Set(visibleGroups.flatMap((g) => g.houses));
    return houses.filter((h) => ids.has(h.id));
  }, [mode, visibleHouses, visibleGroups, houses]);

  const hits = mode === "houses" ? visibleHouses.length : visibleGroups.length;
  const detail = selected ? byId.get(selected) : null;

  if (error) return <Notice>Die Daten ließen sich nicht laden. {error}</Notice>;
  if (!city) return <Notice>Wird geladen …</Notice>;

  const head = (
    <Head
      mode={mode}
      setMode={setMode}
      filters={filters}
      setFilters={setFilters}
      onOpenFilters={() => setFilterOpen(true)}
      hits={hits}
    />
  );

  const list =
    mode === "houses" ? (
      <HouseList houses={visibleHouses} names={city} onSelect={setSelected} />
    ) : dishData ? (
      <GroupList groups={visibleGroups} byId={byId} onSelect={setSelected} />
    ) : (
      <p className="px-4 py-6 text-sm text-ink-muted">Gerichte werden geladen …</p>
    );

  const panel = detail ? (
    <HouseDetail
      house={detail}
      dishes={dishData?.dishes.filter((d) => d.restaurantId === detail.id) ?? []}
      loading={detail.dishCount > 0 && !dishData}
      onClose={() => setSelected(null)}
      names={city}
    />
  ) : null;

  return (
    <>
      <div className="hidden h-full lg:flex lg:flex-row-reverse">
        <div className="min-w-0 flex-1 border-l border-ink-line">
          <CityMap
            restaurants={onMap}
            center={city.city.center}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="flex w-[27rem] min-w-0 flex-col">
          <DesktopHeader city={city.city.name} />
          {panel ?? (
            <>
              <div className="border-b border-ink-line px-4 py-3">{head}</div>
              <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
            </>
          )}
        </div>
      </div>

      <div className="relative h-full lg:hidden">
        <div className="absolute inset-0">
          <CityMap
            restaurants={onMap}
            center={city.city.center}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end">
          {panel ? (
            <div className="pointer-events-auto max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-ink-line bg-cream shadow-[0_-8px_24px_rgba(28,28,28,0.12)]">
              {panel}
            </div>
          ) : (
            <BottomSheet detent={detent} onDetent={setDetent} head={head}>
              {list}
            </BottomSheet>
          )}
        </div>
      </div>

      {filterOpen && (
        <FilterSheet
          value={filters}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
          kinds={city.kinds}
          cuisines={city.cuisines}
          allergens={dishData?.allergens ?? {}}
          available={available}
          hits={hits}
        />
      )}
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-8 text-sm text-ink-soft">{children}</div>;
}

function DesktopHeader({ city }: { city: string }) {
  return (
    <header className="border-b border-ink-line px-4 pt-4 pb-3">
      <p className="eyebrow">{city}</p>
      <h1 className="headline mt-0.5 text-[1.6rem]">Was gibt es zu essen</h1>
    </header>
  );
}

/**
 * Was fest stehen bleibt: Umschalter, Suche, Filterknopf.
 *
 * Bewusst knapp. Auf dem Telefon liegt darüber die Karte, und jede Zeile hier
 * nimmt ihr Platz weg. Alles, was nicht ständig gebraucht wird, steckt hinter
 * dem Filterknopf, der seine Zahl trägt.
 */
function Head({
  mode,
  setMode,
  filters,
  setFilters,
  onOpenFilters,
  hits,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpenFilters: () => void;
  hits: number;
}) {
  const active = countActive(filters);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-0.5 rounded-lg bg-cream-dark p-0.5 text-sm">
          {(["houses", "dishes"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                mode === m ? "bg-cream text-ink shadow-sm" : "text-ink-muted"
              }`}
            >
              {m === "houses" ? "Häuser" : "Gerichte"}
            </button>
          ))}
        </div>
        <button
          onClick={onOpenFilters}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
            active ? "border-red-500 bg-red-500 text-white" : "border-ink-line text-ink-soft"
          }`}
        >
          Filter
          {active > 0 && <span className="tabular font-medium">{active}</span>}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          placeholder={mode === "houses" ? "Haus suchen" : "Gericht oder Zutat"}
          className="min-w-0 flex-1 rounded-lg border border-ink-line bg-cream px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-ink-muted"
        />
        <Chip
          active={!!filters.openAt}
          onClick={() => setFilters({ ...filters, openAt: filters.openAt ? null : now() })}
          label={filters.openAt ? `offen ${clock(filters.openAt.minute)}` : "offen jetzt"}
        />
      </div>

      <p className="tabular text-xs text-ink-muted">
        {hits} {mode === "houses" ? "Häuser" : "Gerichte"}
      </p>
    </div>
  );
}

function HouseList({
  houses,
  names,
  onSelect,
}: {
  houses: Restaurant[];
  names: CityData;
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
                  {h.dishCount}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">
              {[
                ...(h.kinds ?? []).map((k) => names.kinds[k] ?? k),
                ...h.cuisines.map((c) => names.cuisines[c] ?? c),
              ].join(" · ") || "ohne Angabe"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Die Gerichteliste, gleiche Produkte in einer Zeile.
 *
 * Espresso, Radler und Hugo stehen auf jeder zweiten Karte. Untereinander
 * gelistet ergeben sie eine Wand aus Wiederholungen, in der die eigentlichen
 * Gerichte untergehen. Zusammengefasst zeigt eine Zeile die Preisspanne und
 * wie viele Häuser es führen, aufklappbar bis zum einzelnen Preis.
 */
function GroupList({
  groups,
  byId,
  onSelect,
}: {
  groups: DishGroup[];
  byId: Map<string, Restaurant>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!groups.length) return <Empty />;

  return (
    <ul className="divide-y divide-ink-line">
      {groups.slice(0, 300).map((g) => {
        // Aufklappbar, sobald mehr als ein Eintrag darunter liegt. Das sind
        // meist mehrere Häuser, können aber auch zwei Angebote desselben
        // Hauses sein, etwa Tasse und Haferl Kaffee.
        const many = g.items.length > 1;
        const manyHouses = g.houses.length > 1;
        const expanded = open === g.key;
        return (
          <li key={g.key} className="px-4 py-3">
            <button
              onClick={() => (many ? setOpen(expanded ? null : g.key) : onSelect(g.houses[0]))}
              className="w-full text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{g.label}</span>
                <span className="tabular shrink-0 text-sm text-ink-soft">
                  {many
                    ? priceRange(g)
                    : g.items[0].prices.map(formatPrice).join(" · ") || "ohne Preis"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                {many ? (
                  <span className="rounded bg-cream-dark px-1.5 py-0.5">
                    {manyHouses
                      ? `in ${g.houses.length} Häusern`
                      : `${g.items.length} Angebote`}{" "}
                    {expanded ? "▾" : "▸"}
                  </span>
                ) : (
                  <span>{byId.get(g.houses[0])?.name ?? g.houses[0]}</span>
                )}
                <Marks dish={g.items[0]} />
              </div>
            </button>

            {!many && g.items[0].description && (
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{g.items[0].description}</p>
            )}

            {many && expanded && (
              <ul className="mt-2 space-y-1.5 border-l-2 border-ink-line pl-3">
                {g.items.map((d, i) => (
                  <li key={`${d.restaurantId}-${d.ref ?? i}`} className="flex justify-between gap-3">
                    <button
                      onClick={() => onSelect(d.restaurantId)}
                      className="text-left text-xs underline decoration-ink-line underline-offset-2"
                    >
                      {manyHouses ? byId.get(d.restaurantId)?.name ?? d.restaurantId : d.name}
                    </button>
                    <span className="tabular shrink-0 text-xs text-ink-soft">
                      {d.prices.map(formatPrice).join(" · ") || "ohne Preis"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      {groups.length > 300 && (
        <li className="px-4 py-3 text-xs text-ink-muted">
          {groups.length - 300} weitere, bitte die Suche einengen.
        </li>
      )}
    </ul>
  );
}

/**
 * Die Spanne über mehrere Häuser. Nur dafür, denn bei einem einzelnen Haus
 * wäre "2,10 bis 3,60" irreführend: das sind dort keine zwei Häuser, sondern
 * zwei Größen desselben Getränks, und die stehen einzeln mit ihrem Mass.
 */
function priceRange(g: DishGroup): string {
  if (g.low === null) return "ohne Preis";
  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return g.low === g.high ? `${fmt(g.low)} €` : `${fmt(g.low)} bis ${fmt(g.high!)} €`;
}

function Empty() {
  return <p className="px-4 py-6 text-sm text-ink-muted">Dazu findet sich nichts.</p>;
}

export type { Dish };
