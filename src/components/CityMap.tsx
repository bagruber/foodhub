import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Crosshair, ForkKnife, Minus, Plus } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { papierton } from "@/lib/papierton";
import type { Restaurant } from "@/lib/data";

// Amtliche Vektorkacheln des Bundes, wie in der Baumkarte. Kein Schlüssel,
// keine Cookies, keine Fremdanfrage an einen Anbieter, der mitzählt.
const BASEMAP = "https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json";

/**
 * Rueckfallebene, falls basemap.de nicht erreichbar ist: die graue
 * TopPlusOpen des BKG. Bis September 2026 gab es gar keine, dann zeigte die
 * App bei einem Ausfall Punkte ohne Karte und ohne Hinweis. Das Raster bleibt
 * ungetoent, ein Raster laesst sich nicht kanalweise multiplizieren.
 */
const TOPPLUS: StyleSpecification = {
  version: 8,
  sources: {
    topplus: {
      type: "raster",
      tiles: [
        "https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png",
      ],
      tileSize: 256,
      // Der Quellenvermerk nennt, was tatsaechlich geladen wurde, nicht was
      // geplant war.
      attribution: "TopPlusOpen, © Bundesamt für Kartographie und Geodäsie",
    },
  },
  layers: [{ id: "topplus", type: "raster", source: "topplus" }],
};

/**
 * Ab hier zeichnet die Karte zusätzlich den Gebäudeumriss.
 *
 * Darunter wäre ein Gebäude wenige Pixel gross und als Ziel unbrauchbar. Der
 * Umriss ist ohnehin nur eine Näherung: er umfasst das ganze Gebäude, nicht
 * die Gasträume, und ein Wirtshaus im Erdgeschoss eines Wohnblocks bekommt
 * dessen volle Grundfläche. Erst aus der Nähe kann man das einordnen.
 *
 * Der Punkt bleibt trotzdem stehen. Er ist das, was man antippt und was in
 * jeder Zoomstufe gleich aussieht; der Umriss sagt nur, welches Haus gemeint
 * ist. Blendete der Punkt aus, verschwände beim Hineinzoomen genau die Marke,
 * der man gerade gefolgt ist.
 */
const OUTLINE_ZOOM = 16;

/**
 * Symbolebenen der Basiskarte, die mit unseren Punkten verwechselbar sind.
 *
 * Die Grundkarte setzt eigene Zeichen für Kirchen, Museen, Schulen und
 * Türme, in derselben Grösse und Dichte wie unsere Häuser. Nebeneinander ist
 * nicht zu erkennen, was ein Lokal ist und was ein Kirchturm. Ortsnamen,
 * Strassen und Hausnummern bleiben, nur die Piktogramme gehen.
 */
const HIDE_LAYERS = /^(Gebaeudepunkt_|Symbol_BauwerkP_|Symbol_BauwerksP_|Symbol_BauwerkF_|Symbol_BauwerksF_|Symbol_HistorischP_|Symbol_HistorischF_)/;

/**
 * Der Stil, einmal geholt und dann behalten.
 *
 * Er liegt bei einer fremden Stelle und wiegt 490 kB, der Abruf dauerte
 * gemessen 0,85 s. Vorher stand er hinter den Hausdaten in der Reihe, weil die
 * Karte erst in den Baum kommt, wenn die Häuser da sind; beides nacheinander
 * ist der Grund, warum die Karte spürbar später erscheint als die Liste.
 * `preloadBasemap()` stösst ihn beim Start an, parallel zu allem anderen.
 */
let pending: Promise<StyleSpecification> | null = null;

export function preloadBasemap(): Promise<StyleSpecification> {
  // Erst ausduennen, dann in den Papierton ziehen: Die weggeworfenen Ebenen
  // muessen gar nicht erst durchgerechnet werden.
  pending ??= fetch(BASEMAP)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(trim)
    .then(papierton)
    .catch(() => TOPPLUS);
  return pending;
}

/**
 * Ebenen wegwerfen, die nie zu sehen sind.
 *
 * Der Stil bringt 557 Ebenen mit. Die ausgeblendeten Piktogramme kosten auch
 * unsichtbar noch Übersetzung und Speicher, und die drei Ebenen mit
 * `fill-extrusion` zeichnen Gebäude in drei Dimensionen, was diese Karte
 * nirgends zeigt. Wegwerfen ist billiger als verstecken.
 */
function trim(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.filter(
      (l) => !HIDE_LAYERS.test(l.id) && l.type !== "fill-extrusion",
    ),
  };
}

type Props = {
  restaurants: Restaurant[];
  center: { lat: number; lon: number };
  selected: string | null;
  onSelect: (id: string | null) => void;
  onBereit: () => void;
};

export function CityMap({ restaurants, center, selected, onSelect, onBereit }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ortung = useRef<maplibregl.GeolocateControl | null>(null);
  // Die Marke des gewaehlten Hauses haengt als eigenes Element an der Karte
  // und wird von React hineingezeichnet.
  const markeEl = useRef<HTMLDivElement | null>(null);
  if (!markeEl.current && typeof document !== "undefined") {
    markeEl.current = document.createElement("div");
  }
  const marke = useRef<maplibregl.Marker | null>(null);
  const bereitCb = useRef(onBereit);
  bereitCb.current = onBereit;
  // Zoomknoepfe nur mit Maus (Formsprache-Probe, Punkt 9).
  const [maus] = useState(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  // Der Klick-Handler soll immer den aktuellen aufrufen, ohne die Karte neu
  // aufzubauen. Deshalb über ein Ref statt über die Abhängigkeitsliste.
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map | undefined;
    let cancelled = false;

    (async () => {
      const style = await preloadBasemap();
      if (cancelled || !container.current) return;

      instance = new maplibregl.Map({
        container: container.current,
        style,
        center: [center.lon, center.lat],
        zoom: 13.6,
        attributionControl: { compact: true },
      });
      map.current = instance;
      // Die Ortung steuert weiter MapLibre, die Knoepfe stehen als eigene
      // Gruppe daneben: nur so tragen sie die Zeichen der Familie.
      ortung.current = new maplibregl.GeolocateControl({ trackUserLocation: false });
      instance.addControl(ortung.current, "top-right");
      // Meterstab: ab lg unten links in der Karte, darunter oben links.
      instance.addControl(
        new maplibregl.ScaleControl(),
        window.innerWidth >= 1024 ? "bottom-left" : "top-left",
      );
      instance.once("idle", () => {
        if (!cancelled) bereitCb.current();
      });

      instance.on("load", () => {
        if (!instance) return;

        instance.addSource("outlines", { type: "geojson", data: outlineJson(restaurants) });
        instance.addSource("houses", { type: "geojson", data: pointJson(restaurants) });

        instance.addLayer({
          id: "outline-fill",
          type: "fill",
          source: "outlines",
          minzoom: OUTLINE_ZOOM - 0.5,
          paint: {
            "fill-color": ["case", ["get", "hasMenu"], "#c8102e", "#6f6b63"],
            "fill-opacity": ["interpolate", ["linear"], ["zoom"],
              OUTLINE_ZOOM - 0.5, 0, OUTLINE_ZOOM + 0.5, 0.18],
          },
        });
        instance.addLayer({
          id: "outline-line",
          type: "line",
          source: "outlines",
          minzoom: OUTLINE_ZOOM - 0.5,
          paint: {
            "line-color": ["case", ["get", "hasMenu"], "#c8102e", "#6f6b63"],
            "line-width": 1.5,
            "line-opacity": ["interpolate", ["linear"], ["zoom"],
              OUTLINE_ZOOM - 0.5, 0, OUTLINE_ZOOM + 0.5, 0.85],
          },
        });

        // Häuser ohne eingelesene Karte bleiben Ringe, die mit Karte sind
        // gefüllt. Der Unterschied ist der ehrliche Teil.
        instance.addLayer({
          id: "houses-plain",
          type: "circle",
          source: "houses",
          filter: ["==", ["get", "hasMenu"], false],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 4, 16, 6],
            "circle-color": "#faf7f2",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#6f6b63",
          },
        });
        instance.addLayer({
          id: "houses-menu",
          type: "circle",
          source: "houses",
          filter: ["==", ["get", "hasMenu"], true],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 7, 16, 9],
            "circle-color": "#c8102e",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#faf7f2",
          },
        });
        instance.addLayer({
          id: "houses-label",
          type: "symbol",
          source: "houses",
          minzoom: 14,
          layout: {
            "text-field": ["get", "name"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 14, 11, 17, 13],
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-font": ["Noto Sans Regular"],
            "text-optional": true,
            "text-max-width": 9,
          },
          paint: {
            "text-color": ["case", ["get", "hasMenu"], "#1c1c1c", "#555555"],
            "text-halo-color": "#faf7f2",
            "text-halo-width": 1.8,
          },
        });

        for (const layer of ["houses-plain", "houses-menu", "outline-fill"]) {
          instance.on("click", layer, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") select.current(id);
          });
          instance.on("mouseenter", layer, () => {
            if (instance) instance.getCanvas().style.cursor = "pointer";
          });
          instance.on("mouseleave", layer, () => {
            if (instance) instance.getCanvas().style.cursor = "";
          });
        }
        instance.on("click", (event) => {
          const hits = instance?.queryRenderedFeatures(event.point, {
            layers: ["houses-plain", "houses-menu", "outline-fill"],
          });
          if (!hits?.length) select.current(null);
        });
      });
    })();

    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
  }, [center.lat, center.lon]);

  useEffect(() => {
    const house = restaurants.find((r) => r.id === selected);
    if (!map.current || !house?.location) return;
    map.current.easeTo({
      center: [house.location.lon, house.location.lat],
      zoom: Math.max(map.current.getZoom(), OUTLINE_ZOOM + 0.5),
      duration: 600,
    });
  }, [selected, restaurants]);

  // Die Auswahlmarke: ein Klecks am Ort des gewaehlten Hauses. Nie alle
  // Haeuser als Klecks, sonst ist die Marke keine Auszeichnung mehr.
  useEffect(() => {
    const m = map.current;
    const el = markeEl.current;
    if (!m || !el) return;
    const house = restaurants.find((r) => r.id === selected);
    if (!house?.location) {
      marke.current?.remove();
      marke.current = null;
      return;
    }
    // Erst der Ort, dann an die Karte: `addTo` liest die Koordinaten sofort.
    marke.current ??= new maplibregl.Marker({ element: el });
    marke.current.setLngLat([house.location.lon, house.location.lat]).addTo(m);
  }, [selected, restaurants]);

  // Der Punkt des gewaehlten Hauses geht aus der Punktebene, sonst schaut er
  // unter dem Klecks hervor.
  useEffect(() => {
    const m = map.current;
    if (!m?.getLayer("houses-menu")) return;
    for (const [id, hasMenu] of [
      ["houses-menu", true],
      ["houses-plain", false],
    ] as const) {
      m.setFilter(id, [
        "all",
        ["==", ["get", "hasMenu"], hasMenu],
        ["!=", ["get", "id"], selected ?? ""],
      ]);
    }
  }, [selected]);

  useEffect(() => {
    const m = map.current;
    if (!m?.isStyleLoaded()) return;
    (m.getSource("houses") as maplibregl.GeoJSONSource | undefined)?.setData(pointJson(restaurants));
    (m.getSource("outlines") as maplibregl.GeoJSONSource | undefined)?.setData(
      outlineJson(restaurants),
    );
  }, [restaurants]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />

      {maus ? (
        <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-ink-frame bg-cream shadow-soft">
          <Kartenknopf label="Hineinzoomen" onClick={() => map.current?.zoomIn()}>
            <Plus size={17} aria-hidden />
          </Kartenknopf>
          <Kartenknopf label="Herauszoomen" onClick={() => map.current?.zoomOut()}>
            <Minus size={17} aria-hidden />
          </Kartenknopf>
          <Kartenknopf label="Meinen Standort zeigen" onClick={() => ortung.current?.trigger()}>
            <Crosshair size={17} aria-hidden />
          </Kartenknopf>
        </div>
      ) : (
        // Am Daumen statt am Rand: der Standort-Knopf sitzt ueber dem Blatt
        // und wandert mit, wenn es aufgezogen wird.
        <button
          type="button"
          aria-label="Meinen Standort zeigen"
          onClick={() => ortung.current?.trigger()}
          style={{ bottom: "calc(var(--blatt-hoehe) + 12px)" }}
          className="absolute right-3 z-10 grid h-[42px] w-[42px] place-items-center rounded-xl border border-ink-frame bg-cream text-ink shadow-soft"
        >
          <Crosshair size={20} aria-hidden />
        </button>
      )}

      {selected && markeEl.current && createPortal(<Klecks schluessel={selected} />, markeEl.current)}
    </div>
  );
}

function Kartenknopf({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-[34px] w-[34px] place-items-center text-ink hover:bg-cream-dark [&+&]:border-t [&+&]:border-ink-line"
    >
      {children}
    </button>
  );
}

/**
 * Die Auswahlmarke (Probe 10): Klecks mit bleibendem Hof, dazu ein Ring, der
 * beim Waehlen einmal auseinanderlaeuft. Der Ring haengt am Schluessel des
 * Hauses, damit er bei jeder neuen Wahl von vorn laeuft.
 */
function Klecks({ schluessel }: { schluessel: string }) {
  return (
    <div className="relative h-11 w-11">
      <span aria-hidden className="klecks-hof" />
      <span key={schluessel} aria-hidden className="klecks-ring" />
      <svg
        viewBox="0 0 48 48"
        className="relative h-11 w-11 drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
        aria-hidden
      >
        <path
          d="M25 3.5c8.6.3 17.8 5.2 19.2 14.6 1.5 9.8-4 21.5-14.4 24.9C19.7 46.3 6.6 41.5 4.3 30.7 2 19.6 12.2 3 25 3.5z"
          fill="var(--color-red-100)"
          stroke="var(--color-cream)"
          strokeWidth="2.5"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-red-700">
        <ForkKnife size={19} weight="bold" aria-hidden />
      </span>
    </div>
  );
}

/**
 * Der Rueckgabetyp bleibt abgeleitet. Ihn auszuschreiben brauchte den
 * `GeoJSON`-Namespace aus `@types/geojson`, und das Paket gehoert maplibre-gl,
 * nicht dieser App.
 */
function pointJson(restaurants: Restaurant[]) {
  return {
    type: "FeatureCollection" as const,
    features: restaurants
      .filter((r) => r.location)
      .map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.location!.lon, r.location!.lat] },
        properties: { id: r.id, name: r.name, hasMenu: r.dishCount > 0 },
      })),
  };
}

function outlineJson(restaurants: Restaurant[]) {
  return {
    type: "FeatureCollection" as const,
    features: restaurants
      .filter((r) => r.outline)
      .map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: r.outline!.rings },
        properties: { id: r.id, name: r.name, hasMenu: r.dishCount > 0 },
      })),
  };
}
