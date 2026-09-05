/**
 * Öffnungszeiten im OSM-Format lesen, so weit die Daten es verlangen.
 *
 * `opening_hours.js` kann das vollständig, wiegt aber rund 250 kB gegen die
 * 59 kB, mit denen hier die ganze Karte startet. Die 41 Moosburger Angaben
 * brauchen davon einen kleinen Ausschnitt: Wochentage, Spannen, Feiertage,
 * Ruhetage, Zeiten über Mitternacht. Keine Monatsregeln, keine Wochennummern,
 * kein Sonnenstand.
 *
 * Der Trick liegt im Trennzeichen. `;` trennt Regeln, `,` trennt mal
 * Wochentage (`Mo,We-Sa`), mal Zeitspannen (`11:00-14:30,17:00-22:00`) und
 * mal doch wieder Regeln (`Mo 18:00-01:30, We,Th 18:00-04:00`). Statt das
 * auseinanderzuklamüsern, sucht `RULE` global nach dem Muster
 * "Tagliste, dann Zeitangabe" und überliest die Trenner.
 */

export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
export const WEEKDAY_LABEL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag",
  "Freitag", "Samstag", "Sonntag"] as const;

const DAY = "Mo|Tu|We|Th|Fr|Sa|Su|PH";
const RULE = new RegExp(
  `((?:${DAY})(?:\\s*[-,]\\s*(?:${DAY}))*)\\s+(off|closed|(?:\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}(?:\\s*,\\s*)?)+)`,
  "g",
);

/** Eine Öffnungsspanne an einem Wochentag, in Minuten seit Mitternacht. */
export type Span = { day: number; from: number; to: number };

function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** `Mo-Th,Su` wird zu `[0,1,2,3,6]`. `PH` fällt weg, siehe `isOpenAt`. */
function expandDays(list: string): number[] {
  const out: number[] = [];
  for (const part of list.split(",")) {
    const [a, b] = part.trim().split("-").map((s) => s.trim());
    const from = WEEKDAYS.indexOf(a as (typeof WEEKDAYS)[number]);
    if (from < 0) continue; // PH und anderes, das kein Wochentag ist
    if (b === undefined) {
      out.push(from);
      continue;
    }
    const to = WEEKDAYS.indexOf(b as (typeof WEEKDAYS)[number]);
    if (to < 0) continue;
    for (let d = from; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === to) break;
    }
  }
  return out;
}

/**
 * Ergibt die Öffnungsspannen, oder `null`, wenn der Text nicht diesem Format
 * folgt. Ein Moosburger Haus trägt als Zeit `nach Spielzeit`; das ist keine
 * Angabe, die sich filtern lässt, und soll auch nicht so aussehen.
 */
export function parseHours(osm: string | undefined): Span[] | null {
  if (!osm) return null;
  const spans: Span[] = [];
  const closed = new Set<number>();
  let matched = false;

  for (const [, dayList, timePart] of osm.matchAll(RULE)) {
    matched = true;
    const days = expandDays(dayList);
    if (/^(off|closed)$/.test(timePart.trim())) {
      for (const d of days) closed.add(d);
      continue;
    }
    for (const range of timePart.split(",")) {
      const m = range.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      if (!m) continue;
      for (const d of days) spans.push({ day: d, from: minutes(m[1]), to: minutes(m[2]) });
    }
  }
  if (!matched) return null;
  // Eine spätere Ruhetagsregel schlägt eine frühere Öffnungsregel. In
  // `Mo-Sa 11:00-22:00; Tu off` ist der Dienstag zu, obwohl er im Bereich lag.
  return spans.filter((s) => !closed.has(s.day));
}

/**
 * Ob zu diesem Wochentag und dieser Uhrzeit offen ist.
 *
 * Spannen über Mitternacht (`18:00-01:30`) zählen zum Tag ihres Beginns und
 * werden deshalb zusätzlich am Vortag geprüft. Feiertage bleiben aussen vor:
 * ob heute einer ist, weiss die App nicht, und eine geratene Antwort wäre
 * schlechter als keine.
 */
export function isOpenAt(spans: Span[], day: number, minute: number): boolean {
  const yesterday = (day + 6) % 7;
  return spans.some((s) => {
    if (s.to > s.from) return s.day === day && minute >= s.from && minute < s.to;
    // über Mitternacht
    if (s.day === day && minute >= s.from) return true;
    return s.day === yesterday && minute < s.to;
  });
}

/** Die Spannen eines Tages, als `11:00-14:30, 17:00-22:00`. */
export function formatDay(spans: Span[], day: number): string {
  const own = spans.filter((s) => s.day === day).sort((a, b) => a.from - b.from);
  if (!own.length) return "geschlossen";
  return own.map((s) => `${clock(s.from)}-${clock(s.to)}`).join(", ");
}

export function clock(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
