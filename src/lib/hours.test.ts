import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDay, isOpenAt, parseHours } from "./hours";

/** Minute des Tages aus `HH:MM`. */
const at = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const MO = 0, TU = 1, WE = 2, TH = 3, FR = 4, SA = 5, SU = 6;

describe("parseHours", () => {
  it("liest Bereiche und mehrere Spannen je Tag", () => {
    const spans = parseHours("Mo-Fr 11:00-14:30,17:00-22:30; Sa-Su 17:00-22:30")!;
    expect(isOpenAt(spans, MO, at("12:00"))).toBe(true);
    expect(isOpenAt(spans, MO, at("15:00"))).toBe(false);
    expect(isOpenAt(spans, MO, at("18:00"))).toBe(true);
    expect(isOpenAt(spans, SA, at("12:00"))).toBe(false);
    expect(isOpenAt(spans, SA, at("18:00"))).toBe(true);
  });

  it("laesst einen spaeteren Ruhetag die frueheren Regeln schlagen", () => {
    // Der Dienstag liegt im Bereich Mo-Sa, wird aber danach ausgenommen.
    const spans = parseHours("Mo,We-Sa 11:00-14:30,17:00-22:00; Su,PH 16:00-22:00; Tu off")!;
    expect(isOpenAt(spans, TU, at("12:00"))).toBe(false);
    expect(isOpenAt(spans, WE, at("12:00"))).toBe(true);
    expect(isOpenAt(spans, SU, at("17:00"))).toBe(true);
    expect(formatDay(spans, TU)).toBe("geschlossen");
  });

  it("traegt Spannen ueber Mitternacht in den naechsten Tag", () => {
    const spans = parseHours("Mo 18:00-01:30, We,Th 18:00-04:00, Fr,Sa 18:00-05:30")!;
    expect(isOpenAt(spans, MO, at("23:00"))).toBe(true);
    expect(isOpenAt(spans, TU, at("01:00"))).toBe(true);
    expect(isOpenAt(spans, TU, at("02:00"))).toBe(false);
  });

  it("trennt Regeln auch dort, wo nur ein Komma steht", () => {
    // `,` trennt hier Regeln, nicht Wochentage. Das Muster erkennt das an der
    // folgenden Tagesangabe.
    const spans = parseHours("Mo-Fr 08:30-18:00, Sa 08:30-16:00")!;
    expect(isOpenAt(spans, SA, at("15:00"))).toBe(true);
    expect(isOpenAt(spans, SA, at("17:00"))).toBe(false);
    expect(isOpenAt(spans, SU, at("12:00"))).toBe(false);
  });

  it("nimmt Feiertage nicht fuer einen Wochentag", () => {
    const spans = parseHours("Fr 09:30-17:00; Sa 09:00-16:00; Mo-Th,Su,PH off")!;
    expect(isOpenAt(spans, TH, at("12:00"))).toBe(false);
    expect(isOpenAt(spans, FR, at("12:00"))).toBe(true);
  });

  it("gibt null, wo kein Format erkennbar ist", () => {
    expect(parseHours("nach Spielzeit")).toBeNull();
    expect(parseHours(undefined)).toBeNull();
    expect(parseHours("")).toBeNull();
  });
});

describe("gegen die echten Daten", () => {
  const data = JSON.parse(
    readFileSync("public/data/moosburg/restaurants.json", "utf8"),
  ) as { restaurants: { name: string; openingHours?: { osm?: string } }[] };

  const withHours = data.restaurants.filter((r) => r.openingHours?.osm);

  it("liest alle bis auf die eine Freitextangabe", () => {
    const unreadable = withHours.filter((r) => !parseHours(r.openingHours!.osm)?.length);
    expect(unreadable.map((r) => r.openingHours!.osm)).toEqual(['"nach Spielzeit"']);
  });

  it("erzeugt fuer jeden gelesenen Eintrag mindestens eine Spanne", () => {
    for (const r of withHours) {
      const spans = parseHours(r.openingHours!.osm);
      if (!spans) continue;
      expect(spans.every((s) => s.day >= 0 && s.day <= 6), r.name).toBe(true);
      expect(spans.every((s) => s.from >= 0 && s.from < 1440), r.name).toBe(true);
    }
  });
});
