import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Restaurant } from "@/lib/data";

// Amtliche Vektorkacheln des Bundes, wie in der Baumkarte. Kein Schlüssel,
// keine Cookies, keine Fremdanfrage an einen Anbieter, der mitzählt.
const BASEMAP = "https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json";

/**
 * Ab hier zeigt die Karte Gebäudeumrisse statt Punkte.
 *
 * Darunter wäre ein Gebäude wenige Pixel gross und als Ziel unbrauchbar. Der
 * Umriss ist ohnehin nur eine Näherung: er umfasst das ganze Gebäude, nicht
 * die Gasträume, und ein Wirtshaus im Erdgeschoss eines Wohnblocks bekommt
 * dessen volle Grundfläche. Erst aus der Nähe kann man das einordnen.
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

type Props = {
  restaurants: Restaurant[];
  center: { lat: number; lon: number };
  selected: string | null;
  onSelect: (id: string | null) => void;
};

export function CityMap({ restaurants, center, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  // Der Klick-Handler soll immer den aktuellen aufrufen, ohne die Karte neu
  // aufzubauen. Deshalb über ein Ref statt über die Abhängigkeitsliste.
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map | undefined;
    let cancelled = false;

    (async () => {
      const style: StyleSpecification | string = await fetch(BASEMAP)
        .then((r) => r.json())
        .catch(() => "https://demotiles.maplibre.org/style.json");
      if (cancelled || !container.current) return;

      instance = new maplibregl.Map({
        container: container.current,
        style,
        center: [center.lon, center.lat],
        zoom: 13.6,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.addControl(
        new maplibregl.GeolocateControl({ trackUserLocation: false }),
        "top-right",
      );

      instance.on("load", () => {
        if (!instance) return;

        for (const layer of instance.getStyle().layers ?? []) {
          if (HIDE_LAYERS.test(layer.id)) {
            instance.setLayoutProperty(layer.id, "visibility", "none");
          }
        }

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
              OUTLINE_ZOOM - 0.5, 0, OUTLINE_ZOOM + 0.5, 0.22],
          },
        });
        instance.addLayer({
          id: "outline-line",
          type: "line",
          source: "outlines",
          minzoom: OUTLINE_ZOOM - 0.5,
          paint: {
            "line-color": ["case", ["get", "hasMenu"], "#c8102e", "#6f6b63"],
            "line-width": ["case", ["==", ["get", "id"], ["literal", ""]], 2, 1.5],
            "line-opacity": ["interpolate", ["linear"], ["zoom"],
              OUTLINE_ZOOM - 0.5, 0, OUTLINE_ZOOM + 0.5, 0.9],
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
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 4, 16, 7],
            "circle-color": "#faf7f2",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#6f6b63",
            "circle-opacity": fadeWhereOutlined(),
            "circle-stroke-opacity": fadeWhereOutlined(),
          },
        });
        instance.addLayer({
          id: "houses-menu",
          type: "circle",
          source: "houses",
          filter: ["==", ["get", "hasMenu"], true],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 7, 16, 10],
            "circle-color": "#c8102e",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#faf7f2",
            "circle-opacity": fadeWhereOutlined(),
            "circle-stroke-opacity": fadeWhereOutlined(),
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

  useEffect(() => {
    const m = map.current;
    if (!m?.isStyleLoaded()) return;
    (m.getSource("houses") as maplibregl.GeoJSONSource | undefined)?.setData(pointJson(restaurants));
    (m.getSource("outlines") as maplibregl.GeoJSONSource | undefined)?.setData(
      outlineJson(restaurants),
    );
  }, [restaurants]);

  return <div ref={container} className="h-full w-full" />;
}

/** Wo ein Umriss gezeichnet wird, blendet der Punkt aus, sonst bleibt er. */
function fadeWhereOutlined(): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["get", "hasOutline"],
    ["interpolate", ["linear"], ["zoom"], OUTLINE_ZOOM - 0.5, 1, OUTLINE_ZOOM + 0.5, 0],
    1,
  ];
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
        properties: {
          id: r.id,
          name: r.name,
          hasMenu: r.dishCount > 0,
          hasOutline: !!r.outline,
        },
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
