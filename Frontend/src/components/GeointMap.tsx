import { useEffect, useMemo, useRef, useState } from "react";
import maplibreglPkg, { type GeoJSONSource, type Marker as MarkerType } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const maplibregl = maplibreglPkg;
const { LngLatBounds, Marker } = maplibreglPkg;

import { getBounds, getRouteCoordinates } from "@/lib/mapUtils";
import { PORTS, resolvePort } from "@/lib/port";

interface Props {
  route?: string[];
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const DEFAULT_ROUTE = ["New York", "Rotterdam", "Suez", "Mumbai", "Singapore", "Shanghai"];

interface MapErrorEvent {
  error?: unknown;
  sourceId?: string;
  tile?: unknown;
}

let markerStyleInjected = false;

export function GeointMap({ route }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<MarkerType[]>([]);
  const styleLoadedOnceRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Only keep cities that actually resolve to a known port. Anything unresolved
  // is dropped (and logged) instead of silently producing empty coordinates.
  const activeRoute = useMemo(() => {
    const cleaned = (route ?? []).map((city) => city.trim()).filter((city) => city.length > 0);

    const resolved = cleaned.filter((city) => {
      const port = resolvePort(city);
      if (!port) {
        console.warn(`[GeointMap] Unknown port/city "${city}" — skipping.`);
      }
      return !!port;
    });

    if (resolved.length >= 1) return resolved;

    // Nothing valid came through (e.g. placeholder text like "qrtyui"), fall back
    // to the default route instead of rendering a blank map.
    return DEFAULT_ROUTE;
  }, [route]);

  const coordinates = useMemo(() => getRouteCoordinates(activeRoute), [activeRoute]);

  // Initial map setup + marker CSS injection
  useEffect(() => {
    if (!markerStyleInjected) {
      const style = document.createElement("style");

      style.innerHTML = `
      .geo-marker{
        position:relative;
        width:18px;
        height:18px;
        border-radius:999px;
        background:#0f9fd8;
        border:3px solid #ffffff;
        box-shadow:
          0 0 0 5px rgba(15,159,216,.15),
          0 6px 18px rgba(0,0,0,.18);
        cursor:pointer;
      }

      .geo-marker::after{
        content:'';
        position:absolute;
        inset:-8px;
        border-radius:999px;
        border:2px solid rgba(15,159,216,.35);
        animation:geoPulse 2s infinite;
      }

      @keyframes geoPulse{
        0%{ transform:scale(.6); opacity:1; }
        100%{ transform:scale(1.8); opacity:0; }
      }

      .geo-label{
        margin-top:10px;
        white-space:nowrap;
        padding:6px 10px;
        border-radius:10px;
        background:rgba(255,255,255,.97);
        color:#12344d;
        font-size:12px;
        font-weight:600;
        box-shadow:0 10px 24px rgba(0,0,0,.12);
        border:1px solid rgba(210,226,235,.9);
        user-select:none;
      }

      .maplibregl-popup-content{
        border-radius:12px;
      }
      `;

      document.head.appendChild(style);
      markerStyleInjected = true;
    }

    if (!mapContainer.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: STYLE_URL,
        center: [35, 20],
        zoom: 2.2,
        attributionControl: false,
      });
    } catch (error) {
      console.error("[GeointMap] MapLibre initialization failed:", error);
      setMapError("Map rendering is unavailable in this browser session.");
      return;
    }

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    // IMPORTANT: MapLibre fires "error" for lots of non-fatal things — a single
    // missing tile at the edge of coverage, an aborted fetch from a fast pan/zoom,
    // a glyph/sprite hiccup, etc. Those errors carry a `sourceId`/`tile` and should
    // just be logged, not surfaced as a full-map failure banner.
    //
    // A genuinely fatal failure (style.json itself can't be fetched, e.g. the
    // domain is unreachable) has no sourceId/tile, and critically, "load" never
    // fires afterwards. We only show the red banner for that case.
    map.on("error", (e) => {
      const event = e as MapErrorEvent;
      const err = event.error ?? event;
      const isTileLevelError = Boolean(event.sourceId || event.tile);

      if (isTileLevelError) {
        // Benign — a handful of tiles failing is normal and MapLibre will
        // just leave that area blank/retry; don't nuke the whole map view.
        console.warn("[GeointMap] Non-fatal tile error:", err);
        return;
      }

      console.error("[GeointMap] Fatal MapLibre error:", err);
      setMapError("Map failed to load tiles. Check network access to tiles.openfreemap.org.");
    });

    // Fallback: if the style never finishes loading within a reasonable window,
    // treat that as fatal too (covers cases where no "error" event fires at all,
    // e.g. a silently hanging network request).
    const styleLoadTimeout = window.setTimeout(() => {
      if (!styleLoadedOnceRef.current) {
        setMapError("Map failed to load tiles. Check network access to tiles.openfreemap.org.");
      }
    }, 12000);

    map.on("load", () => {
      styleLoadedOnceRef.current = true;
      window.clearTimeout(styleLoadTimeout);
      setMapError(null);

      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "route-line-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#56c8ff",
          "line-width": 10,
          "line-opacity": 0.18,
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#118fd1",
          "line-width": 4,
          "line-opacity": 0.95,
        },
      });

      // Force a resize once the style/layers are ready — guards against the
      // container reporting 0x0 (or a stale size) at construction time.
      map.resize();
    });

    // Keep the canvas in sync any time the container's actual size changes.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      window.clearTimeout(styleLoadTimeout);
      resizeObserver.disconnect();

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update route, markers, and auto-fit whenever activeRoute/coordinates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateMap = () => {
      if (!map.getSource("route")) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const routeGeoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          },
        ],
      };

      (map.getSource("route") as GeoJSONSource).setData(routeGeoJSON);

      activeRoute.forEach((city, index) => {
        const port = resolvePort(city);
        if (!port) return;

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.alignItems = "center";

        const pin = document.createElement("div");
        pin.className = "geo-marker";

        const label = document.createElement("div");
        label.className = "geo-label";
        label.innerHTML = `
          <div>${port.name}</div>
          <div style="margin-top:2px;color:#5b7285;font-size:11px;font-weight:500;">
            ${port.country}
          </div>
        `;

        wrapper.appendChild(pin);
        wrapper.appendChild(label);

        const marker = new Marker({ element: wrapper, anchor: "bottom" })
          .setLngLat([port.longitude, port.latitude])
          .addTo(map);

        markersRef.current.push(marker);

        if (index === 0) {
          pin.animate(
            [{ transform: "scale(0)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
            { duration: 600, easing: "ease-out" },
          );
        }
      });

      map.resize();

      if (coordinates.length === 1) {
        map.flyTo({ center: coordinates[0], zoom: 5, essential: true, duration: 1400 });
      } else if (coordinates.length > 1) {
        const boundsArray = getBounds(coordinates);
        if (boundsArray) {
          const bounds = new LngLatBounds(boundsArray as [[number, number], [number, number]]);
          map.fitBounds(bounds, { padding: 90, duration: 1800, maxZoom: 6 });
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateMap();
    } else {
      map.once("load", updateMap);
    }

    return () => {
      map.off("load", updateMap);
    };
  }, [activeRoute, coordinates]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div ref={mapContainer} className="absolute inset-0 h-full w-full" />

      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 px-6 text-center text-sm font-medium text-red-600">
          {mapError}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-50/30 via-transparent to-cyan-100/20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/35 to-transparent" />

      <div className="absolute right-4 top-4 rounded-xl border border-sky-100 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold tracking-wide text-sky-900">
            {route?.length ? "Preview · Custom Route" : "Live · Global View"}
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-sky-500 ring-4 ring-sky-200" />
            <span className="text-xs font-medium text-slate-700">Port Location</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1 w-10 rounded-full bg-sky-500" />
            <span className="text-xs font-medium text-slate-700">Shipping Route</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-6 top-6 h-36 w-36 opacity-20">
        <div className="absolute inset-0 rounded-full border border-sky-300" />
        <div className="absolute inset-[16px] rounded-full border border-sky-300" />
        <div className="absolute inset-[32px] rounded-full border border-sky-300" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-sky-200" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-sky-200" />
      </div>

      <div className="absolute bottom-4 right-4 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Route Summary</div>
        <div className="mt-2 flex items-center gap-6">
          <div>
            <div className="text-xl font-bold text-sky-700">{activeRoute.length}</div>
            <div className="text-xs text-slate-500">Stops</div>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <div className="text-xl font-bold text-sky-700">
              {Math.max(activeRoute.length - 1, 0)}
            </div>
            <div className="text-xs text-slate-500">Segments</div>
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Geo Intelligence
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-900">
          Maritime Route Visualization
        </div>
        <div className="mt-1 text-xs text-slate-500">OpenFreeMap Liberty • MapLibre GL</div>
      </div>
    </div>
  );
}
