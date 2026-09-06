import { Bag, Book, Card, Chilli, Clock, Cutlery, House, Leaf, Tag, Truck, Umbrella, Wheat } from "@/components/Icons";
import { EMPTY, countActive, now, toggle, type Filters } from "@/lib/filters";
import { WEEKDAY_LABEL, clock } from "@/lib/hours";

/**
 * Alle Filter, über die volle Fläche.
 *
 * Bewusst kein Ausklappen innerhalb der festen Leiste: ein aufgeklappter
 * Bereich in einem nicht scrollbaren Kopf schiebt sich selbst aus dem Bild.
 * Hier ist die ganze Fläche scrollbar, und der Fuss mit der Trefferzahl bleibt
 * stehen.
 *
 * Sechs Abschnitte aus lauter gleich aussehenden Marken sind schwer zu
 * überfliegen, deshalb zwei Zugaben. Erstens trägt jede Überschrift ihr
 * Zeichen, damit man beim Scrollen sieht, wo man ist, statt zu lesen.
 * Zweitens tragen Art und Küche ihre Anzahl und stehen danach sortiert: mit
 * 27 Küchen in alphabetischer Ordnung steht das eine japanische Haus vor den
 * zwölf bayerischen, und die Liste sagt nichts darüber, was Moosburg
 * eigentlich hat.
 */

type Props = {
  value: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  kinds: Record<string, string>;
  cuisines: Record<string, string>;
  allergens: Record<string, string>;
  /** Gänge, aus `data/vocab/gaenge.json`. Fehlen, solange keine Gerichte geladen sind. */
  courses?: Record<string, { label: string; rang: number }>;
  /** Beschriftung der Zahlungsarten, aus `data/vocab/zahlung.json`. */
  payment: Record<string, string>;
  /** Wie viele Häuser je Art und Küche. Bestimmt Reihenfolge und Zahl. */
  counts: { kinds: Map<string, number>; cuisines: Map<string, number>;
            payment: Map<string, number> };
  hits: number;
};

export function FilterSheet(p: Props) {
  const f = p.value;
  const set = (patch: Partial<Filters>) => p.onChange({ ...f, ...patch });
  const active = countActive(f);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-cream">
      <header className="flex shrink-0 items-baseline justify-between border-b border-ink-line px-4 py-3">
        <h2 className="headline text-lg">Filter</h2>
        <button onClick={p.onClose} className="text-sm underline underline-offset-2">
          Schließen
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <Section title="Geöffnet" icon={<Clock />}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              active={!!f.openAt}
              onClick={() => set({ openAt: f.openAt ? null : now() })}
              label={f.openAt ? "Zeit gewählt" : "egal"}
            />
            {f.openAt && (
              <button
                onClick={() => set({ openAt: now() })}
                className="text-xs underline underline-offset-2"
              >
                jetzt
              </button>
            )}
          </div>
          {f.openAt && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1">
                {WEEKDAY_LABEL.map((label, day) => (
                  <Chip
                    key={label}
                    active={f.openAt!.day === day}
                    onClick={() => set({ openAt: { ...f.openAt!, day } })}
                    label={label.slice(0, 2)}
                  />
                ))}
              </div>
              <label className="block">
                <span className="tabular text-sm">
                  um <strong>{clock(f.openAt.minute)}</strong> Uhr
                </span>
                <input
                  type="range"
                  min={0}
                  max={1425}
                  step={15}
                  value={f.openAt.minute}
                  onChange={(e) =>
                    set({ openAt: { ...f.openAt!, minute: Number(e.target.value) } })
                  }
                  className="mt-1 w-full accent-red-500"
                />
              </label>
              <p className="text-xs text-ink-muted">
                Häuser ohne hinterlegte Öffnungszeit fallen dabei heraus. Feiertage sind nicht
                berücksichtigt.
              </p>
            </div>
          )}
        </Section>

        <Section title="Art des Hauses" icon={<House />}>
          <ChipList
            entries={byCount(p.kinds, p.counts.kinds)}
            selected={f.kinds}
            counts={p.counts.kinds}
            onPick={(k) => set({ kinds: toggle(f.kinds, k) })}
          />
        </Section>

        <Section title="Küche" icon={<Tag />}>
          <ChipList
            entries={byCount(p.cuisines, p.counts.cuisines)}
            selected={f.cuisines}
            counts={p.counts.cuisines}
            onPick={(c) => set({ cuisines: toggle(f.cuisines, c) })}
          />
        </Section>

        {p.courses && (
          <Section
            title="Gang"
            icon={<Cutlery />}
            note="Wirkt nur auf die Gerichtsicht. Zugeordnet über die Überschrift der gedruckten Karte."
          >
            <ChipList
              entries={Object.entries(p.courses)
                .sort((a, b) => a[1].rang - b[1].rang)
                .map(([slug, c]) => [slug, c.label] as [string, string])}
              selected={f.courses}
              onPick={(c) => set({ courses: toggle(f.courses, c) })}
            />
          </Section>
        )}

        <Section title="Ernährung" icon={<Leaf className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={f.diet.includes("vegetarian")}
              onClick={() => set({ diet: toggle(f.diet, "vegetarian") })}
              icon={<Leaf />}
              label="vegetarisch"
            />
            <Chip
              active={f.diet.includes("vegan")}
              onClick={() => set({ diet: toggle(f.diet, "vegan") })}
              icon={<Leaf />}
              label="vegan"
            />
            <Chip
              active={f.spicy}
              onClick={() => set({ spicy: !f.spicy })}
              icon={<Chilli />}
              label="scharf"
            />
          </div>
        </Section>

        <Section
          title="Ohne diese Allergene"
          icon={<Wheat />}
          note="Wirkt auf Gerichte, deren Karte eingelesen ist. Ungekennzeichnete Gerichte bleiben sichtbar, denn fehlende Angabe heisst nicht frei davon."
        >
          <ChipList
            entries={Object.entries(p.allergens)}
            selected={f.without}
            onPick={(a) => set({ without: toggle(f.without, a) })}
          />
        </Section>

        <Section
          title="Zahlung"
          icon={<Card />}
          note="Nur Häuser, für die das ausdrücklich belegt ist. Wo nichts hinterlegt ist, wissen wir es nicht."
        >
          <ChipList
            entries={byCount(p.payment, p.counts.payment)}
            selected={f.payment}
            counts={p.counts.payment}
            onPick={(m) => set({ payment: toggle(f.payment, m) })}
          />
        </Section>

        <Section title="Angebot" icon={<Bag />}>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={f.services.includes("delivery")}
              onClick={() => set({ services: toggle(f.services, "delivery") })}
              icon={<Truck />}
              label="Lieferung"
            />
            <Chip
              active={f.services.includes("takeaway")}
              onClick={() => set({ services: toggle(f.services, "takeaway") })}
              icon={<Bag />}
              label="zum Mitnehmen"
            />
            <Chip
              active={f.services.includes("outdoorSeating")}
              onClick={() => set({ services: toggle(f.services, "outdoorSeating") })}
              icon={<Umbrella />}
              label="Plätze draußen"
            />
            <Chip
              active={f.onlyWithMenu}
              onClick={() => set({ onlyWithMenu: !f.onlyWithMenu })}
              icon={<Book />}
              label="mit Speisekarte"
            />
          </div>
        </Section>
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-ink-line px-4 py-3">
        <button
          onClick={() => p.onChange({ ...EMPTY, query: f.query })}
          disabled={!active}
          className="text-sm text-ink-soft underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
        >
          Zurücksetzen
        </button>
        <button
          onClick={p.onClose}
          className="ml-auto rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white"
        >
          {p.hits} anzeigen
        </button>
      </footer>
    </div>
  );
}

/** Nur was vorkommt, das Häufigste zuerst, bei Gleichstand alphabetisch. */
function byCount(
  labels: Record<string, string>,
  counts: Map<string, number>,
): [string, string][] {
  return Object.entries(labels)
    .filter(([slug]) => counts.has(slug))
    .sort(
      ([a, la], [b, lb]) =>
        counts.get(b)! - counts.get(a)! || la.localeCompare(lb, "de"),
    );
}

function Section({
  title,
  icon,
  note,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="eyebrow flex items-center gap-1.5">
        <span className="text-ink-soft">{icon}</span>
        {title}
      </h3>
      {note && <p className="mt-1 mb-2 text-xs leading-relaxed text-ink-muted">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ChipList({
  entries,
  selected,
  counts,
  onPick,
}: {
  entries: [string, string][];
  selected: string[];
  counts?: Map<string, number>;
  onPick: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([slug, label]) => (
        <Chip
          key={slug}
          active={selected.includes(slug)}
          onClick={() => onPick(slug)}
          label={label}
          count={counts?.get(slug)}
        />
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-red-500 bg-red-500 text-white"
          : "border-ink-line bg-cream text-ink-soft hover:border-ink-muted"
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`tabular ${active ? "opacity-80" : "text-ink-muted"}`}>{count}</span>
      )}
    </button>
  );
}
