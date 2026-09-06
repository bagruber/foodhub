import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY, countActive, matchesDish, matchesHouse, openNow } from "./filters";
import type { Dish, Restaurant } from "./data";

const city = JSON.parse(readFileSync("public/data/moosburg/restaurants.json", "utf8")) as {
  restaurants: Restaurant[];
};
const dishData = JSON.parse(readFileSync("public/data/moosburg/dishes.json", "utf8")) as {
  dishes: Dish[];
};
const houses = city.restaurants;
const byId = new Map(houses.map((h) => [h.id, h]));

describe("countActive", () => {
  it("zaehlt nichts, solange nichts gesetzt ist", () => {
    expect(countActive(EMPTY)).toBe(0);
    // Die Suche ist kein Filter, sie steht sichtbar im Feld.
    expect(countActive({ ...EMPTY, query: "pizza" })).toBe(0);
    expect(countActive({ ...EMPTY, kinds: ["cafe"], spicy: true })).toBe(2);
  });
});

describe("Oeffnungszeiten", () => {
  it("laesst Haeuser ohne verwertbare Angabe herausfallen", () => {
    // Lieber weglassen als jemanden vor eine verschlossene Tuer schicken.
    const ohne = houses.find((h) => !h.openingHours);
    expect(ohne && openNow(ohne, { day: 0, minute: 720 })).toBe(false);
  });

  it("trennt geoeffnet und geschlossen ueber den Tag", () => {
    const filter = (day: number, hour: number) =>
      houses.filter((h) => matchesHouse(h, { ...EMPTY, openAt: { day, minute: hour * 60 } }));
    const nachts = filter(0, 4).length;
    const mittags = filter(0, 12).length;
    const abends = filter(4, 20).length;
    expect(nachts).toBeLessThan(mittags);
    expect(mittags).toBeGreaterThan(0);
    expect(abends).toBeGreaterThan(0);
  });
});

describe("Gerichtefilter", () => {
  const hits = (patch: Partial<typeof EMPTY>) =>
    dishData.dishes.filter((d) =>
      matchesDish(d, { ...EMPTY, ...patch }, byId.get(d.restaurantId)),
    );

  it("findet vegane und vegetarische Gerichte", () => {
    expect(hits({ diet: ["vegan"] }).length).toBeGreaterThan(0);
    // Jedes vegane Gericht ist auch vegetarisch, also nie weniger.
    expect(hits({ diet: ["vegetarian"] }).length).toBeGreaterThanOrEqual(
      hits({ diet: ["vegan"] }).length,
    );
  });

  it("schliesst Gerichte mit einem Allergen aus, nicht die ungekennzeichneten", () => {
    const ohneGluten = hits({ without: ["gluten"] });
    expect(ohneGluten.every((d) => !d.allergens.includes("gluten"))).toBe(true);
    // Wer nichts angibt, bleibt sichtbar: fehlende Angabe heisst nicht frei davon.
    expect(ohneGluten.some((d) => d.allergens.length === 0)).toBe(true);
  });

  it("sucht in Name und Beschreibung", () => {
    const treffer = hits({ query: "spinat" });
    expect(treffer.length).toBeGreaterThan(0);
    expect(
      treffer.every((d) =>
        `${d.name} ${d.description ?? ""}`.toLowerCase().includes("spinat"),
      ),
    ).toBe(true);
  });
});

describe("Zahlungsfilter", () => {
  it("nimmt nur das ausdrueckliche Ja", () => {
    const mitKarte = houses.filter((h) =>
      matchesHouse(h, { ...EMPTY, payment: ["debit_cards"] }),
    );
    expect(mitKarte.length).toBeGreaterThan(0);
    expect(mitKarte.every((h) => h.payment?.debit_cards?.accepted === true)).toBe(true);

    // Ein Haus, das EC ausdruecklich verneint, faellt heraus, und ein Haus
    // ohne jede Angabe auch: fehlende Angabe ist kein Ja.
    const verneint = houses.find((h) => h.payment?.debit_cards?.accepted === false);
    const ohne = houses.find((h) => !h.payment);
    expect(verneint && mitKarte.includes(verneint)).toBeFalsy();
    expect(ohne && mitKarte.includes(ohne)).toBeFalsy();
  });

  it("findet die Haeuser mit MoosburgCard", () => {
    const karte = houses.filter((h) => matchesHouse(h, { ...EMPTY, payment: ["moosburg_card"] }));
    expect(karte.length).toBeGreaterThanOrEqual(6);
    expect(karte.map((h) => h.name)).toContain("La Forchetta");
  });
});

describe("Bewertungen", () => {
  it("traegt zu jeder Bewertung Link und Herkunft", () => {
    const alle = houses.flatMap((h) => h.reviews ?? []);
    expect(alle.length).toBeGreaterThan(0);
    expect(alle.every((r) => r.url && r.provenance?.retrievedAt)).toBe(true);
    // Eine Note ohne Skala liesse sich nicht einordnen.
    expect(alle.every((r) => !r.rating || r.rating.scale > 0)).toBe(true);
  });
});

describe("Hausfilter", () => {
  it("greift auf die Art des Hauses und auf die Kueche getrennt", () => {
    const cafes = houses.filter((h) => matchesHouse(h, { ...EMPTY, kinds: ["cafe"] }));
    const bayerisch = houses.filter((h) => matchesHouse(h, { ...EMPTY, cuisines: ["bavarian"] }));
    expect(cafes.length).toBeGreaterThan(0);
    expect(bayerisch.length).toBeGreaterThan(0);
    expect(cafes.every((h) => h.kinds.includes("cafe"))).toBe(true);
    expect(bayerisch.every((h) => h.cuisines.includes("bavarian"))).toBe(true);
  });

  it("laesst mit 'nur mit Speisekarte' nur Haeuser mit Gerichten uebrig", () => {
    const withMenu = houses.filter((h) => matchesHouse(h, { ...EMPTY, onlyWithMenu: true }));
    expect(withMenu.length).toBeGreaterThan(0);
    expect(withMenu.every((h) => h.dishCount > 0)).toBe(true);
  });
});
