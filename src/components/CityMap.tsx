import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Restaurant } from "@/lib/data";

// Amtliche Vektorkacheln des Bundes, wie in der Baumkarte. Kein Schlüssel,
// keine Cookies, keine Fremdanfrage an einen Anbieter, der mitzählt.
const BASEMAP = "https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json";

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
        zoom: 13.4,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.addControl(new maplibregl.ScaleControl({ maxWidth: 90 }), "bottom-left");

      instance.on("load", () => {
        if (!instance) return;
        instance.addSource("houses", {
          type: "geojson",
          data: toGeoJson(restaurants),
        });

        // Häuser mit eingelesener Speisekarte sind gefüllt und größer, die
        // übrigen bleiben Ringe. Der Unterschied ist der ehrliche Teil: nur
        // hinter den gefüllten stecken Gerichte.
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
            "circle-opacity": 0.95,
          },
        });
        instance.addLayer({
          id: "houses-menu",
          type: "circle",
          source: "houses",
          filter: ["==", ["get", "hasMenu"], true],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 7, 16, 11],
            "circle-color": "#c8102e",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#faf7f2",
          },
        });
        instance.addLayer({
          id: "houses-label",
          type: "symbol",
          source: "houses",
          filter: ["==", ["get", "hasMenu"], true],
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-font": ["Noto Sans Regular"],
            "text-optional": true,
          },
          paint: {
            "text-color": "#1c1c1c",
            "text-halo-color": "#faf7f2",
            "text-halo-width": 1.6,
          },
        });

        for (const layer of ["houses-plain", "houses-menu"]) {
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
            layers: ["houses-plain", "houses-menu"],
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

  // Die Auswahl fliegt an, sobald sie sich ändert, egal ob sie aus der Karte
  // oder aus der Liste kam.
  useEffect(() => {
    const house = restaurants.find((r) => r.id === selected);
    if (!map.current || !house?.location) return;
    map.current.easeTo({
      center: [house.location.lon, house.location.lat],
      zoom: Math.max(map.current.getZoom(), 15),
      duration: 600,
    });
  }, [selected, restaurants]);

  useEffect(() => {
    const source = map.current?.getSource("houses") as maplibregl.GeoJSONSource | undefined;
    source?.setData(toGeoJson(restaurants));
  }, [restaurants]);

  return <div ref={container} className="h-full w-full" />;
}

/**
 * Der Rueckgabetyp bleibt abgeleitet. Ihn auszuschreiben brauchte den
 * `GeoJSON`-Namespace aus `@types/geojson`, und das Paket gehoert maplibre-gl,
 * nicht dieser App. Es hier zu importieren, ohne es zu deklarieren, waere eine
 * Abhaengigkeit, die niemand sieht.
 */
function toGeoJson(restaurants: Restaurant[]) {
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
