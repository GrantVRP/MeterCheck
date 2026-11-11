// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// Made-up demo codes, and saved network results for them.
// With demo mode on, checking these codes makes no network calls, so the demo
// works with no Wi-Fi. The place check and the verdict rules still run for real.
// All fake addresses here are invented for the demo.

import type { LinkFacts } from "./checks/verdict";
import { isPlaceId, type PlaceId } from "./places";
import type { Verdict } from "./types";

export interface DemoCode {
  id: string;
  label: string;
  placeId: PlaceId;
  url: string;
  /** What the check should say when this code is scanned at its own place. */
  expect: Verdict;
  /** Saved answers from the server's look-ups: redirects, website age, Safe Browsing. */
  link: LinkFacts;
}

/** A code that goes straight to its address, with no redirects. */
function direct(url: string, domainAgeDays: number): LinkFacts {
  return { chain: [url], chainComplete: true, chainNote: null, domainAgeDays, safeBrowsing: "skipped" };
}

// The real address on the downtown Peterborough Fast Tap sign (decoded from a published photo).
const REAL = "https://hotspotparking.com/tapPoster/park/htspTap50";
const LOOKALIKE = "https://hotspot-parking-pay.online/zone/1001";
const STICKER = "https://paybyphone-parking.online/pay?zone=CC01";
const UNKNOWN = "https://parkeasy-ptbo.com/pay/1001";
const CITY_SITE = "https://www.peterborough.ca/parking";

/** Every demo code, including ones for cities that are switched off for now. */
const ALL_DEMO_CODES: DemoCode[] = [
  {
    id: "peterborough-real",
    label: "Real Peterborough sign",
    placeId: "downtown-peterborough",
    url: REAL,
    expect: "safe",
    link: direct(REAL, 4200),
  },
  {
    id: "peterborough-lookalike",
    label: "Peterborough look-alike",
    placeId: "downtown-peterborough",
    url: LOOKALIKE,
    expect: "stop",
    link: direct(LOOKALIKE, 6),
  },
  {
    id: "mississauga-sticker",
    label: "Mississauga sticker",
    placeId: "downtown-mississauga",
    url: STICKER,
    expect: "stop",
    link: direct(STICKER, 4),
  },
  {
    // The real Peterborough sign's code, checked in Mississauga: grey "Wrong town?".
    id: "wrong-town",
    label: "Peterborough code in Mississauga",
    placeId: "downtown-mississauga",
    url: REAL,
    expect: "wrong-town",
    link: direct(REAL, 4200),
  },
  {
    id: "unknown-site",
    label: "Unknown website",
    placeId: "downtown-peterborough",
    url: UNKNOWN,
    expect: "stop",
    link: direct(UNKNOWN, 410),
  },
  {
    id: "city-site",
    label: "City's own page",
    placeId: "downtown-peterborough",
    url: CITY_SITE,
    expect: "unsure",
    link: direct(CITY_SITE, 9000),
  },
];

/** The demo codes for the cities we check now. */
export const DEMO_CODES: DemoCode[] = ALL_DEMO_CODES.filter((c) => isPlaceId(c.placeId));

/** Saved network results for a demo code, or null (also null when demo mode is off). */
export function demoLinkFacts(url: string): LinkFacts | null {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;
  return ALL_DEMO_CODES.find((c) => c.url === url.trim())?.link ?? null;
}
