// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Check 1: Place. Where is the person, and does that city use codes at all?
// Pure: no network, so the phone can run it too when it's offline.

import { areaName } from "@/lib/areas";
import { distanceM, insidePolygon, isValidLatLon, type LatLon } from "@/lib/geo";
import { ALL_PLACES, type PlaceId } from "@/lib/places";
import { cityAddresses, cityCompanies, confirmedExpectedUrl, LIVE_CITY_IDS, outsideLabel, registry, type City } from "@/lib/registry";

/** A zone counts as "this one" if the person is within this distance of it. */
export const ZONE_RADIUS_M = 150;

export interface PlaceInput extends LatLon {
  accuracy?: number | null;
}

export interface PlaceCheck {
  /** found: in a city we know. unknown-city: somewhere else. no-location: we don't know where. */
  status: "found" | "unknown-city" | "no-location";
  cityId: string | null;
  cityName: string | null;
  /** The place whose real site, app and phone numbers apply. */
  placeId: PlaceId | null;
  /** What to call where they are, e.g. "Downtown Peterborough", "Toronto" or "Outside Peterborough". */
  label: string;
  /** Outside the cities we check: the nearest city we can name (e.g. "Toronto"), or null. */
  areaName: string | null;
  usesQr: boolean | null;
  /** Every address a real parking code here may go to: the city's providers and trusted private car parks (lower case). */
  allowedHosts: string[];
  /** The companies that run the city's own parking, e.g. ["HotSpot"]. */
  companies: string[];
  /** true: the town doesn't charge for street parking. */
  freeParking: boolean;
  /**
   * Other towns we check whose rough area also covers this spot (near a border).
   * A real code from next door gets NOT SURE there, never SAFE and never STOP.
   */
  nearby: { cityId: string; cityName: string; allowedHosts: string[] }[];
  zone: string | null;
  zoneDistanceM: number | null;
  /** The exact address on this zone's real sign, if someone has confirmed it. */
  expectedUrl: string | null;
  accuracyM: number | null;
  /** Where the person is, if we know. */
  at: LatLon | null;
}

/**
 * How well the point fits inside the city's circles: 0 at a centre, 1 at the edge,
 * null if outside them all. Comparing this (not plain distance) lets a small town
 * win over a big neighbour whose centre is far away.
 */
function circleFit(p: LatLon, c: City): number | null {
  const a = c.area_APPROX;
  const circles: [number, number, number][] = [
    ...(a?.circles ?? []),
    ...(a?.center && a.radius_km ? [[a.center[0], a.center[1], a.radius_km] as [number, number, number]] : []),
  ];
  const fits = circles
    .map(([lat, lon, km]) => distanceM(p, { lat, lon }) / (km * 1000))
    .filter((f) => f <= 1);
  return fits.length ? Math.min(...fits) : null;
}

/**
 * Every registry city whose rough area covers this point, best first.
 * Only live cities count, unless a list is given. A drawn outline wins;
 * otherwise the city whose circles fit the point best.
 */
export function citiesAt(p: LatLon, cityIds: readonly string[] = LIVE_CITY_IDS): City[] {
  return registry.cities
    .filter((c) => cityIds.includes(c.id))
    .map((c) => ({
      c,
      fit: c.area_APPROX?.polygon ? (insidePolygon(p, c.area_APPROX.polygon) ? -1 : null) : circleFit(p, c),
    }))
    .filter((x): x is { c: City; fit: number } => x.fit !== null)
    .sort((x, y) => x.fit - y.fit)
    .map((x) => x.c);
}

/** The middle of a town's rough area: its first circle, or the middle of its outline. */
export function townCentre(c: City): LatLon {
  const a = c.area_APPROX;
  if (a?.circles?.length) return { lat: a.circles[0][0], lon: a.circles[0][1] };
  if (a?.center) return { lat: a.center[0], lon: a.center[1] };
  const pts = a?.polygon ?? [[0, 0]];
  return { lat: pts.reduce((s, q) => s + q[0], 0) / pts.length, lon: pts.reduce((s, q) => s + q[1], 0) / pts.length };
}

/** The town closest to a point, from a list (e.g. the towns that use a company). */
export function nearestTown(p: LatLon | null, towns: City[]): City | null {
  if (!towns.length) return null;
  if (!p) return towns[0];
  return towns.map((c) => ({ c, d: distanceM(p, townCentre(c)) })).sort((a, b) => a.d - b.d)[0].c;
}

/** Which registry city this point is in (the best fit), or null. */
export function findCity(p: LatLon, cityIds: readonly string[] = LIVE_CITY_IDS): City | null {
  return citiesAt(p, cityIds)[0] ?? null;
}

/** A name for a place we don't check yet: a registry city that is switched off, or a nearby city. */
function nameOutside(p: LatLon): string | null {
  return findCity(p, registry.cities.map((c) => c.id))?.name ?? areaName(p);
}

/** Outside every town we check: "Near Bracebridge" if one is within 60 km. */
function nearLabel(p: LatLon): string | null {
  const town = nearestTown(p, registry.cities.filter((c) => c.live));
  return town && distanceM(p, townCentre(town)) <= 60_000 ? `Near ${town.name}` : null;
}

/**
 * Where is the person? Only live cities count as "found".
 * Tests can pass every city id to check rules that are switched off for now.
 */
export function checkPlace(
  loc: PlaceInput | null | undefined,
  { cityIds = LIVE_CITY_IDS }: { cityIds?: readonly string[] } = {},
): PlaceCheck {
  const empty = {
    areaName: null,
    cityId: null,
    cityName: null,
    placeId: null,
    usesQr: null,
    allowedHosts: [],
    companies: [],
    freeParking: false,
    nearby: [],
    zone: null,
    zoneDistanceM: null,
    expectedUrl: null,
  };

  if (!loc || !isValidLatLon(loc.lat, loc.lon)) {
    return { ...empty, status: "no-location", label: "Your location", accuracyM: null, at: null };
  }
  const accuracyM = typeof loc.accuracy === "number" && loc.accuracy >= 0 ? Math.round(loc.accuracy) : null;

  const [city, ...others] = citiesAt(loc, cityIds);
  if (!city) {
    const area = nameOutside(loc);
    return { ...empty, status: "unknown-city", label: area ?? nearLabel(loc) ?? outsideLabel(), areaName: area, accuracyM, at: { lat: loc.lat, lon: loc.lon } };
  }

  // A named place (e.g. Streetsville) if we're close to it, otherwise the city's default place.
  const inCity = ALL_PLACES.filter((p) => p.city.id === city.id);
  const near = inCity
    .map((p) => ({ p, d: distanceM(loc, p.zone) }))
    .filter((x) => x.d <= x.p.radiusM)
    .sort((a, b) => a.d - b.d)[0];
  const place = near?.p ?? inCity.find((p) => p.cityDefault) ?? null;

  // The nearest zone, if it's within ~150 m.
  const nearest = city.demo_zones_SAMPLE
    .map((z) => ({ z, d: distanceM(loc, z) }))
    .sort((a, b) => a.d - b.d)[0];
  const zone = nearest && nearest.d <= ZONE_RADIUS_M ? nearest : null;

  return {
    status: "found",
    cityId: city.id,
    cityName: city.name,
    placeId: place?.id ?? null,
    label: near ? near.p.label : city.name,
    areaName: null,
    usesQr: city.uses_qr_payment,
    allowedHosts: cityAddresses(city),
    companies: cityCompanies(city),
    freeParking: city.free_parking === true,
    nearby: others.map((o) => ({ cityId: o.id, cityName: o.name, allowedHosts: cityAddresses(o) })),
    zone: zone?.z.zone ?? null,
    zoneDistanceM: zone ? Math.round(zone.d) : null,
    expectedUrl: confirmedExpectedUrl(zone?.z),
    accuracyM,
    at: { lat: loc.lat, lon: loc.lon },
  };
}
