import type { LngLatBoundsLike } from "maplibre-gl";
import { resolvePort } from "./port";

export function getCoordinates(city: string) {
  const port = resolvePort(city);
  if (!port) return null;
  return [port.longitude, port.latitude] as [number, number];
}

export function getRouteCoordinates(route?: string[]) {
  if (!route) return [];

  return route.map((city) => getCoordinates(city)).filter(Boolean) as [number, number][];
}

export function getBounds(coordinates: [number, number][]): LngLatBoundsLike | null {
  if (coordinates.length === 0) return null;

  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  coordinates.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
