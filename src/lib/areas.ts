// Names for places Meter Check doesn't check yet, so we can say
// "You're in Toronto" instead of "a city we don't know". Rough circles around
// each city centre, no internet needed. Not official boundaries.

import { distanceM, type LatLon } from "./geo";

const AREAS: { name: string; lat: number; lon: number; km: number }[] = [
  { name: "Toronto", lat: 43.6532, lon: -79.3832, km: 22 },
  { name: "Mississauga", lat: 43.589, lon: -79.6441, km: 14 },
  { name: "Brampton", lat: 43.7315, lon: -79.7624, km: 12 },
  { name: "Vaughan", lat: 43.8372, lon: -79.5083, km: 11 },
  { name: "Markham", lat: 43.8561, lon: -79.337, km: 10 },
  { name: "Richmond Hill", lat: 43.8828, lon: -79.4403, km: 7 },
  { name: "Oakville", lat: 43.4675, lon: -79.6877, km: 10 },
  { name: "Burlington", lat: 43.3255, lon: -79.799, km: 10 },
  { name: "Hamilton", lat: 43.2557, lon: -79.8711, km: 16 },
  { name: "Pickering", lat: 43.8384, lon: -79.0868, km: 8 },
  { name: "Ajax", lat: 43.8509, lon: -79.0204, km: 6 },
  { name: "Whitby", lat: 43.8975, lon: -78.9429, km: 8 },
  { name: "Oshawa", lat: 43.8971, lon: -78.8658, km: 10 },
  { name: "Lindsay", lat: 44.356, lon: -78.74, km: 6 },
  { name: "Lakefield", lat: 44.4228, lon: -78.2711, km: 4 },
  { name: "Cobourg", lat: 43.9593, lon: -78.1677, km: 6 },
  { name: "Port Hope", lat: 43.9516, lon: -78.2928, km: 5 },
  { name: "Belleville", lat: 44.1628, lon: -77.3832, km: 10 },
  { name: "Kingston", lat: 44.2312, lon: -76.486, km: 12 },
  { name: "Ottawa", lat: 45.4215, lon: -75.6972, km: 25 },
  { name: "Barrie", lat: 44.3894, lon: -79.6903, km: 12 },
  { name: "Guelph", lat: 43.5448, lon: -80.2482, km: 9 },
  { name: "Kitchener", lat: 43.4516, lon: -80.4925, km: 9 },
  { name: "Waterloo", lat: 43.4643, lon: -80.5204, km: 6 },
  { name: "London", lat: 42.9849, lon: -81.2453, km: 15 },
  { name: "St. Catharines", lat: 43.1594, lon: -79.2469, km: 10 },
  { name: "Niagara Falls", lat: 43.0896, lon: -79.0849, km: 10 },
  { name: "Windsor", lat: 42.3149, lon: -83.0364, km: 13 },
  { name: "Sudbury", lat: 46.4917, lon: -80.993, km: 15 },
];

/** The nearest named city around this point, or null if none is close. */
export function areaName(p: LatLon): string | null {
  const hit = AREAS.map((a) => ({ a, d: distanceM(p, a) }))
    .filter((x) => x.d <= x.a.km * 1000)
    .sort((x, y) => x.d - y.d)[0];
  return hit?.a.name ?? null;
}
