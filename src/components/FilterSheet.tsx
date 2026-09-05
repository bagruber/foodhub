import { EMPTY, countActive, now, toggle, type Filters } from "@/lib/filters";
import { WEEKDAY_LABEL, clock } from "@/lib/hours";

/**
 * Alle Filter, über die volle Fläche.
 *
 * Bewusst kein Ausklappen innerhalb der festen Leiste: ein aufgeklappter
 * Bereich in einem nicht scrollbaren Kopf schiebt sich selbst aus dem Bild.
 * Hier ist die ganze Fläche scrollbar, und der Fuss mit "Übernehmen" bleibt
 * stehen.
 */

type Props = {
  value: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  kinds: Record<string, string>;
  cuisines: Record<string, string>;
  allergens: Record<string, string>;
  available: { kinds: Set<string>; cuisines: Set<string> };
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
        <Section title="Geöffnet">
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

        <Section title="Art des Hauses">
          <ChipList
            entries={Object.entries(p.kinds).filter(([k]) => p.available.kinds.has(k))}
            selected={f.kinds}
            onPick={(k) => set({ kinds: toggle(f.kinds, k) })}
          />
        </Section>

        <Section title="Küche">
          <ChipList
            entries={Object.entries(p.cuisines).filter(([k]) => p.available.cuisines.has(k))}
            selected={f.cuisines}
            onPick={(c) => set({ cuisines: toggle(f.cuisines, c) })}
          />
        </Section>

        <Section title="Ernährung">
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={f.diet.includes("vegetarian")}
              onClick={() => set({ diet: toggle(f.diet, "vegetarian") })}
              label="vegetarisch"
            />
            <Chip
              active={f.diet.includes("vegan")}
              onClick={() => set({ diet: toggle(f.diet, "vegan") })}
              label="vegan"
            />
            <Chip active={f.spicy} onClick={() => set({ spicy: !f.spicy })} label="scharf" />
          </div>
        </Section>

        <Section
          title="Ohne diese Allergene"
          note="Wirkt auf Gerichte, deren Karte eingelesen ist. Ungekennzeichnete Gerichte bleiben sichtbar, denn fehlende Angabe heisst nicht frei davon."
        >
          <ChipList
            entries={Object.entries(p.allergens)}
            selected={f.without}
            onPick={(a) => set({ without: toggle(f.without, a) })}
          />
        </Section>

        <Section title="Angebot">
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={f.services.includes("delivery")}
              onClick={() => set({ services: toggle(f.services, "delivery") })}
              label="Lieferung"
            />
            <Chip
              active={f.services.includes("takeaway")}
              onClick={() => set({ services: toggle(f.services, "takeaway") })}
              label="zum Mitnehmen"
            />
            <Chip
              active={f.services.includes("outdoorSeating")}
              onClick={() => set({ services: toggle(f.services, "outdoorSeating") })}
              label="Plätze draußen"
            />
            <Chip
              active={f.onlyWithMenu}
              onClick={() => set({ onlyWithMenu: !f.onlyWithMenu })}
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

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="eyebrow">{title}</h3>
      {note && <p className="mt-1 mb-2 text-xs leading-relaxed text-ink-muted">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ChipList({
  entries,
  selected,
  onPick,
}: {
  entries: [string, string][];
  selected: string[];
  onPick: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([slug, label]) => (
        <Chip key={slug} active={selected.includes(slug)} onClick={() => onPick(slug)} label={label} />
      ))}
    </div>
  );
}

export function Chip({
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
