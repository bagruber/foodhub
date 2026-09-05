import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupDishes, normaliseName } from "./group";
import type { Dish } from "./data";

const dish = (name: string, restaurantId: string, amount: number): Dish =>
  ({
    name,
    restaurantId,
    section: "Test",
    prices: [{ amount, currency: "EUR" }],
    markersRaw: [],
    allergens: [],
    additives: [],
    diet: {},
  }) as Dish;

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
