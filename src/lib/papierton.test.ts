import { describe, expect, it } from "vitest";
import { papierton, toene } from "./papierton";

/** Paint-Block einer Ebene aus dem getoenten Stil holen. */
function paint(style: unknown, i: number): Record<string, unknown> {
  return (style as { layers: { paint: Record<string, unknown> }[] }).layers[i].paint;
}

describe("toene", () => {
  it("macht aus Weiss den Papierton", () => {
    expect(toene("#ffffff")).toBe("#faf7f2");
    expect(toene("#fff")).toBe("#faf7f2");
    expect(toene("rgb(255, 255, 255)")).toBe("rgb(250, 247, 242)");
  });

  it("laesst Schwarz schwarz", () => {
    expect(toene("#000000")).toBe("#000000");
    expect(toene("rgb(0, 0, 0)")).toBe("rgb(0, 0, 0)");
  });

  it("behaelt das Alpha", () => {
    expect(toene("rgba(255, 255, 255, 0.4)")).toBe("rgba(250, 247, 242, 0.4)");
  });

  it("nimmt die Schreibweise von basemap.de ohne Leerzeichen", () => {
    expect(toene("rgb(255,255,255)")).toBe("rgb(250, 247, 242)");
    expect(toene("rgb(102,102,102)")).toBe("rgb(100, 99, 97)");
  });

  it("laesst alles in Ruhe, was keine Farbe ist", () => {
    for (const wert of ["interpolate", "linear", "get", "strasse", "#zu-lang-fuer-hex", "hsl(0, 0%, 100%)", ""]) {
      expect(toene(wert)).toBe(wert);
    }
  });
});

describe("papierton", () => {
  it("toent Farben in interpolate", () => {
    const style = {
      layers: [
        {
          id: "a",
          paint: {
            "fill-color": ["interpolate", ["linear"], ["zoom"], 8, "#ffffff", 14, "#000000"],
          },
        },
      ],
    };
    expect(paint(papierton(style), 0)["fill-color"]).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      8,
      "#faf7f2",
      14,
      "#000000",
    ]);
  });

  it("toent Farben in match", () => {
    const style = {
      layers: [
        {
          id: "b",
          paint: {
            "line-color": ["match", ["get", "art"], "weg", "#ffffff", "rgba(0, 0, 0, 0.5)"],
          },
        },
      ],
    };
    expect(paint(papierton(style), 0)["line-color"]).toEqual([
      "match",
      ["get", "art"],
      "weg",
      "#faf7f2",
      "rgba(0, 0, 0, 0.5)",
    ]);
  });

  it("laesst Nicht-Farben und Zahlen unberuehrt", () => {
    const style = {
      layers: [
        { id: "a", paint: { "line-width": 2, "line-dasharray": [5, 4], "line-cap": "round" } },
      ],
    };
    expect(paint(papierton(style), 0)).toEqual({
      "line-width": 2,
      "line-dasharray": [5, 4],
      "line-cap": "round",
    });
  });

  it("ruehrt den uebergebenen Stil nicht an", () => {
    const style = { layers: [{ id: "a", paint: { "fill-color": "#ffffff" } }] };
    papierton(style);
    expect(style.layers[0].paint["fill-color"]).toBe("#ffffff");
  });
});
