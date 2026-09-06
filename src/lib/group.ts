import type { Dish } from "./data";
import katalog from "../../data/vocab/produkte.json";

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
    //
    // Geprüft wird gegen Leerzeichen statt `\b`: JavaScript zählt Umlaute
    // nicht zu den Wortzeichen, deshalb sieht `\bfl\b` mitten in `Flötzinger`
    // eine Wortgrenze und machte daraus `ötzinger`.
    .replace(/(^|\s)(fl\.?|flasche)(?=\s|$)/gi, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zäöüß ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Der Produktkatalog: welcher Name meint welches Produkt.
 *
 * Der maschinelle Weg über den Wortkern reicht nur bis `Espresso` gleich
 * `Espresso`. Er sieht nicht, dass `Tafelwasser still` und `Stilles Wasser`
 * dasselbe sind, und er darf es auch nicht raten: sechs Häuser teilen sich das
 * Wort `Salat` mit fünfzehn völlig verschiedenen Gerichten, vier das Wort
 * `Curry`. Wer nach Wortüberschneidung zusammenfasst, legt den Papayasalat
 * neben den Wurstsalat.
 *
 * Deshalb steht in `data/vocab/produkte.json` ausgeschrieben, welche
 * Schreibweisen dasselbe Produkt meinen. Was dort nicht steht, bleibt für
 * sich. Der Preis dafür ist Pflege: eine neue Karte bringt neue Schreibweisen,
 * und die fallen erst auf, wenn zwei Zeilen nebeneinander stehen, die eine
 * sein sollten.
 */
type Product = { id: string; label: string };

const PRODUCTS: Map<string, Product> = new Map(
  Object.entries(katalog.produkte).flatMap(([id, p]) =>
    p.schreibweisen.map((s) => [s, { id, label: p.label }] as [string, Product]),
  ),
);

/** Die Schreibweisen aus dem Katalog, für den Test auf Normalform. */
export const catalogueSpellings = Object.values(katalog.produkte).flatMap(
  (p) => p.schreibweisen,
);

export type DishGroup = {
  key: string;
  /** Der Katalogname, sonst der längste der vorkommenden Namen. */
  label: string;
  items: Dish[];
  houses: string[];
  /** Niedrigster und höchster Preis über alle Häuser. */
  low: number | null;
  high: number | null;
};

export function groupDishes(dishes: Dish[]): DishGroup[] {
  const buckets = new Map<string, Dish[]>();
  const labels = new Map<string, string>();
  for (const dish of dishes) {
    const name = normaliseName(dish.name) || dish.name.toLowerCase();
    const product = PRODUCTS.get(name);
    const key = product?.id ?? name;
    buckets.set(key, [...(buckets.get(key) ?? []), dish]);
    if (product) labels.set(key, product.label);
  }

  const groups: DishGroup[] = [];
  for (const [key, items] of buckets) {
    const amounts = items.flatMap((d) => d.prices.map((p) => p.amount));
    groups.push({
      key,
      label: labels.get(key) ?? longestName(items),
      items,
      houses: [...new Set(items.map((d) => d.restaurantId))],
      low: amounts.length ? Math.min(...amounts) : null,
      high: amounts.length ? Math.max(...amounts) : null,
    });
  }
  return groups;
}

/**
 * Der vollständigste der vorkommenden Namen, ohne die Menge am Ende.
 *
 * Der längste Name ist meist der vollständigste, `Coca Cola Fl.` gegen `Cola`.
 * Er trägt aber auch die Menge, die genau das Haus dazuschreibt, das sie
 * dazuschreibt: die Gruppe hieß `Hugo 0,2l`, obwohl drei der vier Häuser
 * schlicht `Hugo` drucken.
 */
function longestName(items: Dish[]): string {
  const name = items.reduce((a, b) => (b.name.length > a.name.length ? b : a)).name;
  return name.replace(/\s+\d+[,.]?\d*\s*(l|cl|ml|g)\b\.?$/i, "").trim() || name;
}

/**
 * Gruppen mit mehreren Häusern nach oben ist falsch, nach unten auch: gesucht
 * ist meist ein Gericht, nicht ein Getränk. Sortiert wird deshalb nach Preis
 * wie zuvor, die Bündelung ändert nur die Zeilenzahl.
 */
export function sortByPrice(groups: DishGroup[]): DishGroup[] {
  return [...groups].sort((a, b) => (a.low ?? 1e9) - (b.low ?? 1e9));
}
