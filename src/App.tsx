import { useEffect, useMemo, useState } from "react";
import { BottomSheet, type Detent } from "@/components/BottomSheet";
import { CityMap, preloadBasemap } from "@/components/CityMap";
import { FilterSheet } from "@/components/FilterSheet";
import { HouseDetail } from "@/components/HouseDetail";
import { Book, Chilli, Clock, Cutlery, House, Leaf, Sliders } from "@/components/Icons";
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
import {
  EMPTY,
  countActive,
  matchesDish,
  matchesHouse,
  now,
  toggle,
  type Filters,
} from "@/lib/filters";
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
  const [detent, setDetent] = useState<Detent>("peek");

  useEffect(() => {
    // Der Kartenstil hängt an einer fremden Adresse und wiegt 490 kB. Sein
    // Abruf beginnt hier und nicht erst, wenn die Karte im Baum steht: sonst
    // wartet er auf die Häuser, und die Karte bleibt eine Sekunde länger leer.
    preloadBasemap();
    loadCity(CITY).then(setCity).catch((e) => setError(String(e)));
  }, []);

  // Die Gerichte kommen erst, wenn jemand sie braucht. Die Karte soll nicht
  // auf 200 kB warten, die die meisten Besucher nie öffnen. Ein geöffnetes
  // Haus mit Speisekarte braucht sie auch.
  const needDishes = mode === "dishes" || filters.without.length > 0 || !!selected;
  useEffect(() => {
    if (!needDishes || dishData) return;
    loadDishes(CITY).then(setDishData).catch((e) => setError(String(e)));
  }, [needDishes, dishData]);

  const houses = city?.restaurants ?? [];
  const byId = useMemo(() => new Map(houses.map((h) => [h.id, h])), [houses]);

  // Wie oft eine Art und eine Küche vorkommt. Die Filterliste sortiert danach,
  // sonst steht das eine japanische Haus vor den zwölf bayerischen.
  const counts = useMemo(() => {
    const tally = (pick: (h: Restaurant) => string[]) => {
      const map = new Map<string, number>();
      for (const h of houses) for (const s of pick(h)) map.set(s, (map.get(s) ?? 0) + 1);
      return map;
    };
    return { kinds: tally((h) => h.kinds ?? []), cuisines: tally((h) => h.cuisines) };
  }, [houses]);

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

  // Suche und Wechsel in die Gerichte holen das Blatt herauf: beides fragt
  // nach der Liste, und die ist unten zugeklappt.
  const show = () => setDetent((d) => (d === "peek" ? "half" : d));

  const head = (
    <Head
      mode={mode}
      setMode={(m) => {
        setMode(m);
        show();
      }}
      filters={filters}
      setFilters={setFilters}
      onOpenFilters={() => setFilterOpen(true)}
      onFocusSearch={show}
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

  // Die Trefferzahl steht am Kopf der Liste und nicht in der festen Leiste:
  // dort kostete sie eine ganze Zeile Kartenfläche.
  const counted = (
    <>
      <p className="tabular border-b border-ink-line px-4 py-2 text-xs text-ink-muted">
        {hits} {mode === "houses" ? "Häuser" : "Gerichte"}
      </p>
      {list}
    </>
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
              <div className="min-h-0 flex-1 overflow-y-auto">{counted}</div>
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
              {counted}
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
          counts={counts}
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
 * Was in jeder Rastung stehen bleibt: Umschalter, Suche, Filterreihe.
 *
 * Zwei Zeilen, mehr nicht. Auf dem Telefon liegt darüber die Karte, und jede
 * Zeile hier nimmt ihr Platz weg. Der Umschalter ist deshalb auf seine Zeichen
 * zusammengezogen, damit die Suche daneben passt statt darunter.
 *
 * Die Filterreihe scrollt waagrecht. Was ständig gebraucht wird, steht darin;
 * alles Übrige liegt hinter dem ersten Knopf, der seine Zahl trägt.
 */
function Head({
  mode,
  setMode,
  filters,
  setFilters,
  onOpenFilters,
  onFocusSearch,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpenFilters: () => void;
  onFocusSearch: () => void;
}) {
  const active = countActive(filters);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 gap-0.5 rounded-lg bg-cream-dark p-0.5 text-xs">
          {(
            [
              ["houses", "Häuser", House],
              ["dishes", "Gerichte", Cutlery],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 font-medium transition ${
                mode === m ? "bg-cream text-ink shadow-sm" : "text-ink-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <input
          value={filters.query}
          onFocus={onFocusSearch}
          onChange={(e) => set({ query: e.target.value })}
          placeholder={mode === "houses" ? "Haus suchen" : "Gericht oder Zutat"}
          className="min-w-0 flex-1 rounded-lg border border-ink-line bg-cream px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-ink-muted"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex touch-pan-x items-center gap-1.5 overflow-x-auto px-4">
        <button
          onClick={onOpenFilters}
          className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            active ? "border-red-500 bg-red-500 text-white" : "border-ink-line text-ink-soft"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Filter
          {active > 0 && <span className="tabular">{active}</span>}
        </button>
        <span className="h-4 w-px shrink-0 bg-ink-line" />
        <Quick
          active={!!filters.openAt}
          onClick={() => set({ openAt: filters.openAt ? null : now() })}
          icon={<Clock className="h-3.5 w-3.5" />}
          label={filters.openAt ? `offen ${clock(filters.openAt.minute)}` : "offen jetzt"}
        />
        <Quick
          active={filters.diet.includes("vegetarian")}
          onClick={() => set({ diet: toggle(filters.diet, "vegetarian") })}
          icon={<Leaf className="h-3.5 w-3.5" />}
          label="vegetarisch"
        />
        <Quick
          active={filters.diet.includes("vegan")}
          onClick={() => set({ diet: toggle(filters.diet, "vegan") })}
          icon={<Leaf className="h-3.5 w-3.5" />}
          label="vegan"
        />
        <Quick
          active={filters.spicy}
          onClick={() => set({ spicy: !filters.spicy })}
          icon={<Chilli className="h-3.5 w-3.5" />}
          label="scharf"
        />
        <Quick
          active={filters.onlyWithMenu}
          onClick={() => set({ onlyWithMenu: !filters.onlyWithMenu })}
          icon={<Book className="h-3.5 w-3.5" />}
          label="mit Karte"
        />
      </div>
    </div>
  );
}

function Quick({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition ${
        active
          ? "border-red-500 bg-red-500 text-white"
          : "border-ink-line bg-cream text-ink-soft hover:border-ink-muted"
      }`}
    >
      {icon}
      {label}
    </button>
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
 * Gerichte untergehen. Zusammengefasst zeigt eine Zeile die Preisspanne,
 * aufklappbar bis zum einzelnen Haus.
 *
 * Das Haus steht in jeder Zeile: bei einem oder zwei Häusern ausgeschrieben,
 * ab dreien mit Zahl, weil vier Namen nebeneinander nicht mehr lesbar sind.
 * Aufgeklappt steht es immer, denn dort ist es die eigentliche Auskunft: wo
 * kostet dieser Hugo was.
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
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  return (
    <ul className="divide-y divide-ink-line">
      {groups.slice(0, 300).map((g) => {
        // Aufklappbar, sobald mehr als ein Eintrag darunter liegt. Das sind
        // meist mehrere Häuser, können aber auch zwei Angebote desselben
        // Hauses sein, etwa Tasse und Haferl Kaffee.
        const many = g.items.length > 1;
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
                <span className={many ? "rounded bg-cream-dark px-1.5 py-0.5" : undefined}>
                  {houseLine(g, nameOf)}
                  {many && (expanded ? " ▾" : " ▸")}
                </span>
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
                      className="min-w-0 text-left text-xs"
                    >
                      <span className="underline decoration-ink-line underline-offset-2">
                        {nameOf(d.restaurantId)}
                      </span>
                      {/* Der gedruckte Name nur dort, wo er vom Gruppennamen
                          abweicht: sonst stünde `Cola` hinter jedem Haus. */}
                      {d.name !== g.label && <span className="text-ink-muted"> · {d.name}</span>}
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

function houseLine(g: DishGroup, nameOf: (id: string) => string): string {
  if (g.houses.length === 1) {
    const one = nameOf(g.houses[0]);
    return g.items.length > 1 ? `${one} · ${g.items.length} Angebote` : one;
  }
  if (g.houses.length === 2) return g.houses.map(nameOf).join(" und ");
  return `${nameOf(g.houses[0])} und ${g.houses.length - 1} weitere`;
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
