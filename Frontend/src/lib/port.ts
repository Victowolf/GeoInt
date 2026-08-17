export interface PortLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const PORTS: Record<string, PortLocation> = {
  "New York": {
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
  },
  Rotterdam: {
    name: "Rotterdam",
    country: "Netherlands",
    latitude: 51.9225,
    longitude: 4.47917,
  },
  Suez: {
    name: "Suez",
    country: "Egypt",
    latitude: 29.9668,
    longitude: 32.5498,
  },
  Mumbai: {
    name: "Mumbai",
    country: "India",
    latitude: 19.076,
    longitude: 72.8777,
  },
  Shanghai: {
    name: "Shanghai",
    country: "China",
    latitude: 31.2304,
    longitude: 121.4737,
  },
  Singapore: {
    name: "Singapore",
    country: "Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
  },
};

// Shared case/whitespace-insensitive lookup so "new york" or " Rotterdam "
// both resolve. Used by GeointMap (markers) AND mapUtils (route line) so
// the two never disagree about which cities are valid.
const PORT_KEYS_LOWER: Record<string, string> = Object.keys(PORTS).reduce(
  (acc, key) => {
    acc[key.trim().toLowerCase()] = key;
    return acc;
  },
  {} as Record<string, string>,
);

export function resolvePort(city: string): PortLocation | undefined {
  if (!city) return undefined;
  const direct = PORTS[city];
  if (direct) return direct;
  const key = PORT_KEYS_LOWER[city.trim().toLowerCase()];
  return key ? PORTS[key] : undefined;
}
