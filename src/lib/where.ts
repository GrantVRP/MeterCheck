// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Which town the help, pay and report screens are about, and how to pay there.
// The town comes from the last check, else GPS, else the place picked by hand.
// Everything here comes from our own lists, never from a scanned code.

import { checkPlace } from "./checks/place";
import { getPlace, type AppLinks, type Place } from "./places";
import { getProvider } from "./providers";
import { getCity, type City, type ReportContact } from "./registry";
import type { CheckResult, Fix } from "./types";

export interface Town {
  city: City | null;
  /** One of our named places (Downtown Peterborough, Streetsville...), which have their own app and machine notes. */
  place: Place | null;
  zone: string | null;
  /** Where the person is, if we know. Used for a report's pin. */
  spot: { lat: number; lon: number } | null;
}

export interface TownInput {
  /** The last check. Ignored when `ignoreResult` is set (e.g. "Pay without scanning" from Home). */
  result: CheckResult | null;
  /** Where the last check was made, if the phone knew. */
  spot: { lat: number; lon: number } | null;
  fix: Fix | null;
  useGps: boolean;
  placeId: string;
  ignoreResult?: boolean;
}

export function townFrom(i: TownInput): Town {
  if (i.result && !i.ignoreResult) {
    const place = i.result.placeId ? getPlace(i.result.placeId) : null;
    return {
      city: getCity(i.result.cityId),
      place,
      zone: i.result.zone,
      spot: i.spot ?? (place && i.result.zone === place.zone.zone ? { lat: place.zone.lat, lon: place.zone.lon } : null),
    };
  }
  if (i.useGps) {
    if (!i.fix) return { city: null, place: null, zone: null, spot: null };
    const p = checkPlace(i.fix);
    return {
      city: getCity(p.cityId),
      place: p.placeId ? getPlace(p.placeId) : null,
      zone: p.zone,
      spot: { lat: i.fix.lat, lon: i.fix.lon },
    };
  }
  const place = getPlace(i.placeId);
  return { city: place.city, place, zone: place.zone.zone, spot: { lat: place.zone.lat, lon: place.zone.lon } };
}

/** Numbers that are right anywhere in Canada. Used when we don't know the town. */
const ANYWHERE: ReportContact[] = [
  { who: "Canadian Anti-Fraud Centre", phone: "1-888-495-8501" },
  { who: "Your bank or card company", phone: "Number on the back of your card" },
];

export function helpContacts(town: Town): ReportContact[] {
  return town.city?.report_to?.length ? town.city.report_to : ANYWHERE;
}

const label = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** The official apps and websites for paying here, from our own list. Empty if we don't know the town. */
export function payApps(town: Town): AppLinks[] {
  if (town.place && town.place.city.id === town.city?.id) return town.place.app ? [town.place.app] : [];
  if (!town.city) return [];
  const seen = new Set<string>();
  const apps: AppLinks[] = [];
  for (const o of town.city.operators) {
    const paysHere = o.kind ? o.kind === "pay" : !/ticket|permit/i.test(o.role ?? "");
    if (o.confidence === "unverified" || !paysHere) continue;
    const p = getProvider(o.provider ?? o.name);
    const site = o.pay_site ?? p?.website;
    if (!p || !site || seen.has(p.id)) continue;
    seen.add(p.id);
    const store = (p as { app_store?: { ios?: string; android?: string } }).app_store;
    apps.push({
      // A town's own pay page is named for the town, not the company behind it.
      name: o.pay_site ? town.city.name : p.name,
      ios: o.app_ios ?? store?.ios,
      android: o.app_android ?? store?.android,
      web: { url: site, label: label(site) },
    });
  }
  return apps;
}

/** What to say about paying at the machine (or not paying at all). */
export function machineNote(town: Town): { headline: string; detail: string } {
  if (town.place && town.place.city.id === town.city?.id) return town.place.machine;
  if (town.city?.pay_note) return town.city.pay_note;
  if (town.city?.free_parking) {
    return { headline: "Street parking here is free", detail: `${town.city.name} doesn't charge for parking on its streets. Check the sign for time limits.` };
  }
  if (town.city) return { headline: "Or pay at the machine", detail: "Follow the steps on the machine itself." };
  return {
    headline: "Pay at the machine",
    detail: "Or use the official app named on the sign. Never pay through a code on a sticker.",
  };
}

/**
 * Does paying here use a zone number from the sign (e.g. HotSpot in Peterborough, PayByPhone in Streetsville)?
 * If so, the Pay screen says to open the app and type the sign's zone number there.
 * Not in Downtown Mississauga (pay at the machine), or where you pay by plate.
 */
export function hasZones(town: Town): boolean {
  if (town.place && town.place.city.id === town.city?.id) return Boolean(town.place.app);
  return payApps(town).length > 0 && !town.city?.free_parking && town.city?.zone_numbers !== false;
}
