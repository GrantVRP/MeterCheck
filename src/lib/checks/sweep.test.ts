// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// Every town we check, one by one: a made-up address or a look-alike is never SAFE,
// and the town's own parking company is SAFE at the centre of town.
import { describe, expect, it } from "vitest";
import { getProvider } from "@/lib/providers";
import { cityCompanies, LIVE_CITY_IDS, registry } from "@/lib/registry";
import { checkPlace } from "./place";
import { decide, type LinkFacts } from "./verdict";

const link = (url: string): LinkFacts => ({ chain: [url], chainComplete: true, chainNote: null, domainAgeDays: 3000, safeBrowsing: "clean" });

const live = registry.cities.filter((c) => LIVE_CITY_IDS.includes(c.id));

/** The centre of the town's first circle (or outline). */
function centre(c: (typeof live)[number]) {
  const a = c.area_APPROX!;
  if (a.circles?.length) return { lat: a.circles[0][0], lon: a.circles[0][1] };
  const pts = a.polygon!;
  return { lat: pts.reduce((s, p) => s + p[0], 0) / pts.length, lon: pts.reduce((s, p) => s + p[1], 0) / pts.length };
}

const FAKES = [
  "https://parking-pay-now.com/zone/1001",
  "https://hotspot-parking-pay.online/zone/1001",
  "https://paybyphone-parking.online/pay",
  "https://honkmobile.ca/pay",
  "https://greenp-pay.com/",
  "https://parkedin.ca/",
  "https://passportparking.ca/",
  "https://bit.ly/abc123",
  "https://203.0.113.9/pay",
];

describe("every town we check", () => {
  it("has an area, so GPS can find it", () => {
    for (const c of live) expect(c.area_APPROX?.circles?.length || c.area_APPROX?.polygon?.length, c.id).toBeTruthy();
  });

  for (const c of live) {
    it(`${c.name}: fakes are never safe, its own company is`, () => {
      const place = checkPlace(centre(c));
      expect(place.cityId, "found at its own centre").toBe(c.id);
      for (const url of FAKES) expect(decide({ place, url, link: link(url), sticker: null }).verdict, url).toBe("stop");

      for (const name of cityCompanies(c)) {
        const site = getProvider(name)?.website;
        if (!site) continue;
        const d = decide({ place, url: site, link: link(site), sticker: null });
        expect(d.verdict, `${name} ${site}`).toBe(c.uses_qr_payment ? "safe" : d.verdict);
      }
    });
  }
});
