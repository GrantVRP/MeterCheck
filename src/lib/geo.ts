// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Small map maths. Coordinates are [lat, lon] in degrees.

export interface LatLon {
  lat: number;
  lon: number;
}

/** Distance in metres between two points (haversine formula). */
export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Is the point inside the outline? Casts a line east from the point and counts
 * how many edges it crosses: an odd count means inside.
 */
export function insidePolygon(p: LatLon, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const crosses = latI > p.lat !== latJ > p.lat && p.lon < ((lonJ - lonI) * (p.lat - latI)) / (latJ - latI) + lonI;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function isValidLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}
