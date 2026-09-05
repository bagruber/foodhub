import type { Dish } from "./data";

/**
 * Gleiche Produkte über Häuser hinweg zusammenfassen.
 *
 * Vor allem Getränke wiederholen sich: Espresso, Radler und Hugo stehen auf
 * jeder zweiten Karte. Untereinander gelistet ergeben sie eine Wand aus
 * Wiederholungen, in der die eigentlichen Gerichte untergehen.
 *
 * Zusammengefasst wird nur für die Anzeige. In den Daten behält jedes Haus
 * seinen eigenen Preis und seine eigene Herkunft, denn genau darin liegt der
 * Nutzen: derselbe Hugo kostet hier 7,90 und dort 8,50.
 */

/**
 * Namen vergleichbar machen.
 *
 * Weg müssen die Bestandteile, die dasselbe Produkt in zwei Häusern
 * verschieden aussehen lassen: Mengen (`0,5l`, `2 Stück`), Klammerzusätze,
 * angeklebte Allergenmarker und Ziffern. Was bleibt, ist der Wortkern.
 *
 * Bewusst konservativ: `Chicken Curry` und `Hähnchencurry` bleiben getrennt,
 * obwohl es dasselbe sein mag. Zwei Gerichte fälschlich zu verschmelzen wäre
 * schlimmer als zwei Zeilen zu viel, weil dann Preis und Herkunft eines Hauses
 * unter dem Namen eines anderen stünden.
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+[,.]?\d*\s*(l|cl|ml|g|stück|st|portion)\b/g, " ")
    // `Fl.` ist die Darreichung, nicht die Grösse: die steht daneben als
    // `0,33l`. Grössenwörter wie Tasse oder Haferl bleiben dagegen stehen,
    // denn sie unterscheiden zwei Angebote mit eigenem Preis.
    .replace(/\bfl\.?\b|\bflasche\b/gi, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zäöüß ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type DishGroup = {
  key: string;
  /** Der längste der vorkommenden Namen, meist der vollständigste. */
  label: string;
  items: Dish[];
  houses: string[];
  /** Niedrigster und höchster Preis über alle Häuser. */
  low: number | null;
  high: number | null;
};

export function groupDishes(dishes: Dish[]): DishGroup[] {
  const buckets = new Map<string, Dish[]>();
  for (const dish of dishes) {
    const key = normaliseName(dish.name) || dish.name.toLowerCase();
    buckets.set(key, [...(buckets.get(key) ?? []), dish]);
  }

  const groups: DishGroup[] = [];
  for (const [key, items] of buckets) {
    const amounts = items.flatMap((d) => d.prices.map((p) => p.amount));
    groups.push({
      key,
      label: items.reduce((a, b) => (b.name.length > a.name.length ? b : a)).name,
      items,
      houses: [...new Set(items.map((d) => d.restaurantId))],
      low: amounts.length ? Math.min(...amounts) : null,
      high: amounts.length ? Math.max(...amounts) : null,
    });
  }
  return groups;
}

/**
 * Gruppen mit mehreren Häusern nach oben ist falsch, nach unten auch: gesucht
 * ist meist ein Gericht, nicht ein Getränk. Sortiert wird deshalb nach Preis
 * wie zuvor, die Bündelung ändert nur die Zeilenzahl.
 */
export function sortByPrice(groups: DishGroup[]): DishGroup[] {
  return [...groups].sort((a, b) => (a.low ?? 1e9) - (b.low ?? 1e9));
}
