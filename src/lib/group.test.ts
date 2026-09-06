import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueSpellings, groupDishes, normaliseName, sortByCourse } from "./group";
import type { Dish } from "./data";

const dish = (
  name: string,
  restaurantId: string,
  amount: number,
  course = "hauptgericht",
): Dish =>
  ({
    name,
    restaurantId,
    section: "Test",
    course,
    prices: [{ amount, currency: "EUR" }],
    markersRaw: [],
    allergens: [],
    additives: [],
    diet: {},
  }) as Dish;

const RANG: Record<string, number> = {
  vorspeise: 1,
  hauptgericht: 4,
  nachspeise: 6,
  bier: 10,
  andere: 14,
};
const rang = (course: string) => RANG[course] ?? 99;

describe("normaliseName", () => {
  it("raeumt weg, was dasselbe Produkt verschieden aussehen laesst", () => {
    expect(normaliseName("Coca Cola Fl. 0,33l")).toBe(normaliseName("Coca Cola"));
    expect(normaliseName("Glas Prosecco 0,1l")).toBe("glas prosecco");
    expect(normaliseName("Samosa (2 Stück)")).toBe("samosa");
    expect(normaliseName("Libella Cola Zero 3,4,6,7")).toBe("libella cola zero");
  });

  it("laesst verschiedene Gerichte verschieden", () => {
    // Lieber zwei Zeilen zu viel als zwei Gerichte falsch verschmolzen: sonst
    // stuende der Preis des einen Hauses unter dem Namen des anderen.
    expect(normaliseName("Chicken Curry")).not.toBe(normaliseName("Hähnchencurry"));
    expect(normaliseName("Weißweinschorle")).not.toBe(normaliseName("Rotweinschorle"));
  });
});

describe("Produktkatalog", () => {
  it("fuehrt jede Schreibweise schon in Normalform", () => {
    // Sonst greift der Eintrag nie: verglichen wird gegen normaliseName().
    // Wandert die Zurichtung, faellt es hier auf und nicht erst daran, dass
    // zwei Zeilen nebeneinander stehen, die eine sein sollten.
    const schief = catalogueSpellings.filter((s) => normaliseName(s) !== s);
    expect(schief).toEqual([]);
  });

  it("fasst die Faelle zusammen, an denen der Wortkern scheitert", () => {
    const alle = JSON.parse(readFileSync("public/data/moosburg/dishes.json", "utf8")) as {
      dishes: Dish[];
    };
    const groups = groupDishes(alle.dishes);
    const von = (label: string) => groups.find((g) => g.label === label);

    expect(von("Stilles Wasser")!.houses.length).toBeGreaterThan(1);
    expect(von("Kaffee")!.items.map((d) => d.name)).toContain("Tasse Kaffee");
    expect(von("Kaffee")!.items.map((d) => d.name)).toContain("Haferl Kaffee");
    expect(von("Aperol Spritz")!.houses.length).toBeGreaterThanOrEqual(4);
  });

  it("legt nicht zusammen, was nur ein Wort teilt", () => {
    const alle = JSON.parse(readFileSync("public/data/moosburg/dishes.json", "utf8")) as {
      dishes: Dish[];
    };
    const groups = groupDishes(alle.dishes);
    const salate = groups.filter((g) => g.label.toLowerCase().includes("salat"));
    // Papayasalat und Wurstsalat sind nicht dasselbe Produkt.
    expect(salate.length).toBeGreaterThan(8);
    // Hell und dunkel sind eine Sorte, keine Schreibweise.
    expect(groups.find((g) => g.label === "Weißbier")!.key).not.toBe(
      groups.find((g) => g.label === "Weißbier dunkel")!.key,
    );
  });
});

describe("groupDishes", () => {
  it("fasst gleiches aus mehreren Haeusern zusammen und behaelt die Spanne", () => {
    const groups = groupDishes([
      dish("Espresso", "a", 2.5),
      dish("Espresso", "b", 2.9),
      dish("Hugo 0,2l", "a", 7.9),
    ]);
    expect(groups).toHaveLength(2);
    const espresso = groups.find((g) => g.key === "espresso")!;
    expect(espresso.houses).toEqual(["a", "b"]);
    expect([espresso.low, espresso.high]).toEqual([2.5, 2.9]);
  });

  it("nimmt den laengsten Namen als Beschriftung", () => {
    const groups = groupDishes([dish("Espresso", "a", 3), dish("Espresso doppelt", "b", 3.5)]);
    // Zwei Namen, zwei Gruppen: `doppelt` ist ein anderes Getränk, nicht
    // dasselbe in anders geschrieben.
    expect(groups).toHaveLength(2);
    const beide = groupDishes([dish("Cola", "a", 3), dish("Cola Fl.", "b", 3.5)]);
    expect(beide).toHaveLength(1);
    expect(beide[0].label).toBe("Cola Fl.");
  });

  it("wirft nichts weg", () => {
    const all = JSON.parse(readFileSync("public/data/moosburg/dishes.json", "utf8")) as {
      dishes: Dish[];
    };
    const groups = groupDishes(all.dishes);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(all.dishes.length);
    expect(groups.length).toBeLessThan(all.dishes.length);
  });
});

describe("sortByCourse", () => {
  it("ordnet nach Gang und nicht nach Preis", () => {
    // Der eigentliche Anlass: nach Preis stand die Beilage fuer 40 Cent vor
    // dem Schweinebraten, und die Getraenke standen mitten in den Speisen.
    const out = sortByCourse(
      groupDishes([
        dish("Helles", "a", 4.2, "bier"),
        dish("Schweinebraten", "b", 16.9),
        dish("Vitello Tonnato", "c", 12.5, "vorspeise"),
      ]),
      rang,
    );
    expect(out.map((s) => s.course)).toEqual(["vorspeise", "hauptgericht", "bier"]);
  });

  it("stellt innerhalb eines Gangs das Verbreitete nach vorn", () => {
    const out = sortByCourse(
      groupDishes([
        dish("Cordon Bleu", "a", 17.9),
        dish("Schnitzel", "a", 15.5),
        dish("Schnitzel", "b", 16.5),
        dish("Schnitzel", "c", 14.9),
      ]),
      rang,
    );
    expect(out[0].groups.map((g) => g.label)).toEqual(["Schnitzel", "Cordon Bleu"]);
  });

  it("nimmt bei uneinigen Gaengen den haeufigeren", () => {
    // Espresso steht bei einem Haus unter `Warme Getraenke`, beim naechsten
    // unter `Zum Abschluss`. Die Mehrheit entscheidet, damit dieselbe Gruppe
    // nicht je nach Ladereihenfolge woanders landet.
    const out = sortByCourse(
      groupDishes([
        dish("Espresso", "a", 2.4, "nachspeise"),
        dish("Espresso", "b", 2.6, "andere"),
        dish("Espresso", "c", 2.5, "nachspeise"),
      ]),
      rang,
    );
    expect(out.map((s) => s.course)).toEqual(["nachspeise"]);
  });
});
