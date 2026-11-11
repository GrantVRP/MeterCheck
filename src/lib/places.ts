// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// The places we support, built from the registry.
// Each place knows its "real site" and how to pay without scanning.
// Only places in a live city (LIVE_CITY_IDS) are shown; the rest are ready for later.

import { getCity, LIVE_CITY_IDS, type City, type DemoZone, type Operator } from "./registry";

export type PlaceId = "downtown-peterborough" | "downtown-mississauga" | "streetsville";

export interface AppLinks {
  name: string;
  ios?: string;
  android?: string;
  web?: { url: string; label: string };
}

export interface Place {
  id: PlaceId;
  label: string;
  city: City;
  zone: DemoZone;
  /** GPS within this distance of the zone counts as this place. */
  radiusM: number;
  /** Used for the rest of the city when GPS isn't near a named place. */
  cityDefault: boolean;
  /** Where "Go to the real site" takes you. Never the scanned address. */
  realSite: { url: string; label: string };
  /** Official app for paying without scanning, if this place has one. */
  app: AppLinks | null;
  /** What to say about paying at the machine. */
  machine: { headline: string; detail: string };
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`Registry is missing ${what}`);
  return value;
}

function operator(city: City, name: string): Operator {
  return must(
    city.operators.find((o) => o.name === name),
    `${name} in ${city.id}`,
  );
}

function zone(city: City, id: string): DemoZone {
  return must(
    city.demo_zones_SAMPLE.find((z) => z.zone === id),
    `zone ${id}`,
  );
}

const peterborough = must(getCity("peterborough-on"), "peterborough-on");
const mississauga = must(getCity("mississauga-on"), "mississauga-on");
const hotspot = operator(peterborough, "HotSpot");
const paybyphone = operator(mississauga, "PayByPhone");
const hotspotHost = must(hotspot.allowed_qr_hosts?.[0], "HotSpot host");

// Prefer the "www." host for links we open ourselves.
const paybyphoneHost = paybyphone.official_hosts?.find((h) => h.startsWith("www.")) ?? paybyphone.official_hosts?.[0];

/** Every place, including cities that are switched off for now. */
export const ALL_PLACES: Place[] = [
  {
    id: "downtown-peterborough",
    label: "Downtown Peterborough",
    city: peterborough,
    zone: zone(peterborough, "SAMPLE-1001"),
    radiusM: 1500,
    cityDefault: true,
    // Agreed for now: HotSpot's QR host. Revisit once a real sign is decoded.
    realSite: { url: `https://${hotspotHost}`, label: hotspotHost },
    app: { name: "HotSpot", ios: hotspot.app_ios, android: hotspot.app_android },
    machine: { headline: "Or pay at the machine", detail: "The machines and meters take coins." },
  },
  {
    id: "downtown-mississauga",
    label: "Downtown Mississauga",
    city: mississauga,
    zone: zone(mississauga, "SAMPLE-DT-01"),
    radiusM: 1500,
    // Outside Streetsville, Mississauga's real site is the City's page and you pay at the machine.
    cityDefault: true,
    realSite: { url: mississauga.official_page, label: "mississauga.ca" },
    app: null,
    machine: {
      headline: "Use the screen on the machine",
      detail: "It takes coins, Visa, Mastercard, American Express, Apple Pay and Google Wallet.",
    },
  },
  {
    id: "streetsville",
    label: "Streetsville",
    city: mississauga,
    zone: zone(mississauga, "SAMPLE-ST-01"),
    radiusM: 1500,
    cityDefault: false,
    realSite: { url: `https://${must(paybyphoneHost, "PayByPhone host")}`, label: "paybyphone.com" },
    app: {
      name: "PayByPhone",
      ios: paybyphone.app_ios,
      android: paybyphone.app_android,
      web: { url: `https://${paybyphoneHost}`, label: "paybyphone.com" },
    },
    machine: { headline: "Or pay at the machine", detail: "It takes coins and cards." },
  },
];

/** The places people can pick: only those in a live city. */
export const PLACES: Place[] = ALL_PLACES.filter((p) => LIVE_CITY_IDS.includes(p.city.id));

export const DEFAULT_PLACE: PlaceId = "downtown-peterborough";

export function isPlaceId(id: unknown): id is PlaceId {
  return PLACES.some((p) => p.id === id);
}

export function getPlace(id: PlaceId | string | null | undefined): Place {
  return PLACES.find((p) => p.id === id) ?? PLACES.find((p) => p.id === DEFAULT_PLACE)!;
}
