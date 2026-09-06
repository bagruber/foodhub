import type { Dish, Restaurant } from "./data";
import { isOpenAt, parseHours } from "./hours";

/**
 * Der gesamte Filterzustand an einer Stelle.
 *
 * An einer Stelle, weil er an drei Orten gebraucht wird: in der Liste, auf der
 * Karte und im Filterblatt. Lägen die Regeln verteilt, zeigte die Karte
 * irgendwann etwas anderes als die Liste darunter.
 */
export type Filters = {
  query: string;
  kinds: string[];
  cuisines: string[];
  diet: ("vegetarian" | "vegan")[];
  spicy: boolean;
  /** Allergene, die nicht vorkommen dürfen. */
  without: string[];
  services: ("delivery" | "takeaway" | "outdoorSeating")[];
  /** Zahlungsarten, die angenommen werden muessen. Slugs aus dem Vokabular. */
  payment: string[];
  onlyWithMenu: boolean;
  /** Wochentag 0 bis 6 und Minute seit Mitternacht, oder aus. */
  openAt: { day: number; minute: number } | null;
};

export const EMPTY: Filters = {
  query: "",
  kinds: [],
  cuisines: [],
  diet: [],
  spicy: false,
  without: [],
  services: [],
  payment: [],
  onlyWithMenu: false,
  openAt: null,
};

/** Wie viele Filter greifen. Steht als Zahl am Filterknopf. */
export function countActive(f: Filters): number {
  return (
    f.kinds.length +
    f.cuisines.length +
    f.diet.length +
    f.without.length +
    f.services.length +
    f.payment.length +
    (f.spicy ? 1 : 0) +
    (f.onlyWithMenu ? 1 : 0) +
    (f.openAt ? 1 : 0)
  );
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function now(): { day: number; minute: number } {
  const d = new Date();
  // JavaScript zählt ab Sonntag, OSM ab Montag.
  return { day: (d.getDay() + 6) % 7, minute: d.getHours() * 60 + d.getMinutes() };
}

/**
 * Ob ein Haus zur gewünschten Zeit offen hat.
 *
 * Ohne verwertbare Angabe fällt es durch, sobald nach Öffnungszeit gefiltert
 * wird. Das ist die unangenehmere, aber ehrlichere Wahl: ein Haus als offen zu
 * zeigen, von dem wir es nicht wissen, schickt jemanden vor eine verschlossene
 * Tür.
 */
export function openNow(house: Restaurant, at: { day: number; minute: number }): boolean {
  const spans = parseHours(house.openingHours?.osm);
  return spans ? isOpenAt(spans, at.day, at.minute) : false;
}

export function matchesHouse(house: Restaurant, f: Filters): boolean {
  if (f.onlyWithMenu && !house.dishCount) return false;
  if (f.kinds.length && !f.kinds.some((k) => house.kinds?.includes(k))) return false;
  if (f.cuisines.length && !f.cuisines.some((c) => house.cuisines.includes(c))) return false;
  if (f.services.length && !f.services.every((s) => house.services?.[s])) return false;
  // Nur ein ausdrückliches Ja zählt. Wo nichts steht, wissen wir es nicht, und
  // ein Haus in die Trefferliste zu nehmen, weil eine Angabe fehlt, hiesse
  // jemanden mit der falschen Karte in der Tasche hinschicken.
  if (f.payment.length && !f.payment.every((m) => house.payment?.[m]?.accepted)) return false;
  if (f.openAt && !openNow(house, f.openAt)) return false;
  // Ernährung greift am Haus nur, wo keine Karte gelesen ist. Wo eine da ist,
  // entscheidet das einzelne Gericht, und das prüft `matchesDish`.
  if (f.diet.length && !house.dishCount) {
    const has = f.diet.some((d) => house.diet?.[d] === "yes" || house.diet?.[d] === "only");
    if (!has) return false;
  }
  if (f.query && !house.name.toLowerCase().includes(f.query.trim().toLowerCase())) return false;
  return true;
}

export function matchesDish(dish: Dish, f: Filters, house: Restaurant | undefined): boolean {
  if (f.diet.length && !f.diet.some((d) => dish.diet[d])) return false;
  if (f.spicy && !dish.spice) return false;
  // Ueber ein Set statt `includes`, weil die Filterliste aus dem Vokabular
  // kommt und deshalb weitere Zeichenketten als `Allergen` enthalten kann.
  if (f.without.length) {
    const banned = new Set<string>(f.without);
    if (dish.allergens.some((a) => banned.has(a))) return false;
  }
  if (f.kinds.length && !f.kinds.some((k) => house?.kinds?.includes(k))) return false;
  if (f.cuisines.length && !f.cuisines.some((c) => house?.cuisines.includes(c))) return false;
  if (f.services.length && !f.services.every((s) => house?.services?.[s])) return false;
  if (f.payment.length && !f.payment.every((m) => house?.payment?.[m]?.accepted)) return false;
  if (f.openAt && (!house || !openNow(house, f.openAt))) return false;
  if (f.query) {
    const needle = f.query.trim().toLowerCase();
    const hay = `${dish.name} ${dish.description ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}
