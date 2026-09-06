/**
 * Die gebündelten Daten einer Stadt, wie `etl/bundle.py` sie ablegt.
 *
 * Zwei Dateien, absichtlich getrennt: die Karte startet mit `restaurants.json`
 * und wartet nicht auf die 753 Gerichte. `dishes.json` wird erst geholt, wenn
 * jemand nach einem Gericht sucht.
 *
 * Die Bausteine kommen aus `schema/types.ts`, damit das Datenmodell an einer
 * Stelle steht. Eigen ist hier nur, was das Bündeln hinzufügt: `dishCount`
 * statt der Kartendateien, `menuProvenance` statt der Karten selbst, und am
 * Gericht das Haus und der Abschnitt, aus dem es stammt.
 */

import type {
  Address,
  Allergen,
  Basis,
  DietFlag,
  HouseDiet,
  MenuItem,
  Ordering,
  Outline,
  Payment,
  Price,
  Provenance,
  Review,
  Services,
} from "../../schema/types";

export type { Payment, Price, Provenance, Review };

export type Restaurant = {
  id: string;
  name: string;
  /** Art des Hauses, Slugs aus `data/vocab/kinds.json`. */
  kinds: string[];
  /** Küche, Slugs aus `data/vocab/cuisines.json`. */
  cuisines: string[];
  /** Wie viele Gerichte aus eingelesenen Karten vorliegen. */
  dishCount: number;
  osm?: string;
  address?: Address;
  location?: { lat: number; lon: number; provenance: Provenance };
  outline?: Outline;
  contact?: { phone?: string; email?: string; website?: string };
  openingHours?: { raw: string; osm?: string; provenance: Provenance };
  services?: Services;
  diet?: HouseDiet;
  payment?: Payment;
  ordering?: Ordering[];
  reviews?: Review[];
  /** Herkunft je eingelesener Kartenversion. */
  menuProvenance?: Provenance[];
};

export type Dish = MenuItem & {
  restaurantId: string;
  section: string;
};

export type { Allergen, Basis, DietFlag };

export type CityData = {
  city: { id: string; name: string; center: { lat: number; lon: number }; bbox: number[] };
  kinds: Record<string, string>;
  cuisines: Record<string, string>;
  /** Beschriftung der Zahlungsarten, aus `data/vocab/zahlung.json`. */
  payment: Record<string, string>;
  restaurants: Restaurant[];
};

export type DishData = {
  allergens: Record<string, string>;
  additives: Record<string, string>;
  dishes: Dish[];
};

const base = import.meta.env.BASE_URL;

export async function loadCity(city: string): Promise<CityData> {
  const response = await fetch(`${base}data/${city}/restaurants.json`);
  if (!response.ok) throw new Error(`restaurants.json: ${response.status}`);
  return response.json();
}

export async function loadDishes(city: string): Promise<DishData> {
  const response = await fetch(`${base}data/${city}/dishes.json`);
  if (!response.ok) throw new Error(`dishes.json: ${response.status}`);
  return response.json();
}

/** Kleinster Preis eines Gerichts, für Sortierung und Preisfilter. */
export function lowestPrice(dish: Dish): number | null {
  const amounts = dish.prices.map((p) => p.amount);
  return amounts.length ? Math.min(...amounts) : null;
}

export function formatPrice(price: Price): string {
  const amount = price.amount.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const suffix = price.portion ?? price.note;
  return suffix ? `${amount} € ${suffix}` : `${amount} €`;
}

const MONTHS = "Januar Februar März April Mai Juni Juli August September Oktober November Dezember".split(" ");

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day}. ${MONTHS[month - 1]} ${year}`;
}

/**
 * Wie alt eine Angabe ist, in Worten.
 *
 * Der Punkt des Projekts steht und fällt damit, dass jemand das sieht. Eine
 * Karte von 2022 sieht sonst genauso aus wie eine von letzter Woche.
 */
export function age(iso: string): { label: string; stale: boolean } {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 31) return { label: "diesen Monat", stale: false };
  const months = Math.round(days / 30.4);
  if (months < 12) return { label: `vor ${months} Monaten`, stale: months >= 9 };
  const years = Math.floor(days / 365.25);
  return { label: years === 1 ? "vor einem Jahr" : `vor ${years} Jahren`, stale: true };
}

export const SOURCE_LABEL: Record<Provenance["kind"], string> = {
  pdf: "Speisekarte als PDF",
  website: "Website des Hauses",
  osm: "OpenStreetMap",
  google_maps: "Google Maps",
  tripadvisor: "Tripadvisor",
  restaurantguru: "Restaurant Guru",
  manual: "vor Ort erfasst",
};
