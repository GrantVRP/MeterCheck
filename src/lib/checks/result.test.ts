// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

import { describe, expect, it } from "vitest";
import { getPlace } from "@/lib/places";
import { DEMO_CODES } from "@/lib/samples";
import { buildResult, NOT_LOOKED_UP } from "./result";
import { MAX_URL_LENGTH, parseCheckRequest } from "./request";
import type { LinkFacts } from "./verdict";

const MISSISSAUGA = { lat: 43.589, lon: -79.6441, accuracy: 10 };
const PETERBOROUGH = { lat: 44.3048, lon: -78.3199, accuracy: 10 };
const TORONTO = { lat: 43.6534, lon: -79.3841, accuracy: 10 };
// Algonquin Park: no town we check is near.
const NOWHERE = { lat: 45.55, lon: -78.6, accuracy: 10 };

const demo = (id: string) => DEMO_CODES.find((c) => c.id === id)!;
const direct = (url: string): LinkFacts => ({
  chain: [url],
  chainComplete: true,
  chainNote: null,
  domainAgeDays: 2000,
  safeBrowsing: "clean",
});

describe("buildResult", () => {
  it("each demo code gives the expected verdict at its own place", () => {
    for (const code of DEMO_CODES) {
      const spot = code.placeId === "downtown-peterborough" ? PETERBOROUGH : MISSISSAUGA;
      const r = buildResult({ url: code.url, ...spot }, code.link, { fromCache: true });
      expect(r.verdict, code.id).toBe(code.expect);
      expect(r.fromCache).toBe(true);
    }
  });

  it("any website that isn't HotSpot is STOP in Peterborough, and says so", () => {
    const url = "https://parkeasy-ptbo.com/pay/1001";
    const r = buildResult({ url, ...PETERBOROUGH }, direct(url));
    expect(r.verdict).toBe("stop");
    expect(r.sentence).toBe("This code does not go to HotSpot, Peterborough's real parking service.");
    expect(r.safeUrl).toBeNull();
  });

  it("Mississauga never uses codes: a made-up one is fake, a real Peterborough one is grey Wrong town?", () => {
    const fake = demo("mississauga-sticker");
    expect(buildResult({ url: fake.url, ...MISSISSAUGA }, fake.link).headline).toBe("Fake link. Don't pay.");
    const code = demo("wrong-town");
    const r = buildResult({ url: code.url, ...MISSISSAUGA }, code.link);
    expect(r.verdict).toBe("wrong-town");
    expect(r.headline).toBe("Wrong town? Don't pay yet.");
    expect(r.sentence).toBe(
      "This code goes to HotSpot, used in Peterborough. You're in Mississauga, where machines have no codes. Your location may be wrong.",
    );
    expect(r.safeUrl).toBeNull();
  });

  it("Ottawa's own app company on a code is still a fake: Ottawa never puts codes on machines", () => {
    const url = "https://m.paybyphone.com/";
    const r = buildResult({ url, lat: 45.4215, lon: -75.6972, accuracy: 10 }, direct(url));
    expect(r.verdict).toBe("stop");
    expect(r.sentence).toBe("Ottawa never puts codes on its parking machines, so this one is fake.");
  });

  it("Toronto: Green P is safe, another company's code is sketchy", () => {
    const green = "https://mobilepay.greenp.com/zone/123";
    expect(buildResult({ url: green, ...TORONTO }, direct(green)).verdict).toBe("safe");
    const r = buildResult({ url: "https://hotspotparking.com/", ...TORONTO }, direct("https://hotspotparking.com/"));
    expect(r.verdict).toBe("wrong-town");
    expect(r.sentence).toMatch(/^This code goes to HotSpot, used in [A-Z][a-z]+. Toronto's signs use Green P. Your location may be wrong.$/);
    expect(r.realSite?.url).toBe("https://www.greenp.com");
  });

  it("SAFE gives the checked address to continue to, and nothing else does", () => {
    const real = demo("peterborough-real");
    expect(buildResult({ url: real.url, ...PETERBOROUGH }, real.link).safeUrl).toBe(real.url);
    const fake = demo("peterborough-lookalike");
    const r = buildResult({ url: fake.url, ...PETERBOROUGH }, fake.link);
    expect(r.safeUrl).toBeNull();
    expect(r.sentence).toBe("This code goes to a website that pretends to be HotSpot.");
    expect(r.details.lookalike?.nearest).toBe("hotspotparking.com");
    expect(r.details.domainAgeDays).toBe(6);
  });

  it("somewhere we don't check: a real company is NOT SURE, never SAFE", () => {
    const r = buildResult({ url: "https://hotspotparking.com/", ...NOWHERE }, direct("https://hotspotparking.com/"));
    expect(r.verdict).toBe("unsure");
    expect(r.sentence).toMatch(/Meter Check doesn't know the parking here yet\./);
  });

  it("marks a picked place (accuracy 0) differently from GPS", () => {
    expect(buildResult({ url: "x", ...MISSISSAUGA, accuracy: 0 }, NOT_LOOKED_UP).details.place?.source).toBe("picked");
    expect(buildResult({ url: "x", ...MISSISSAUGA }, NOT_LOOKED_UP).details.place?.source).toBe("gps");
    expect(buildResult({ url: "x" }, NOT_LOOKED_UP).details.place?.source).toBe("none");
  });

  it("offline: still STOP for a website that isn't HotSpot, never SAFE, and says it couldn't check", () => {
    expect(buildResult({ url: "https://a.com/", ...PETERBOROUGH }, NOT_LOOKED_UP, { offline: true }).verdict).toBe("stop");
    const r = buildResult({ url: "https://hotspotparking.com/", ...PETERBOROUGH }, NOT_LOOKED_UP, { offline: true });
    expect(r.verdict).toBe("unsure");
    expect(r.sentence).toMatch(/right now/);
  });
});

describe("headline and real site", () => {
  it("a look-alike is a fake; an address we don't know is sketchy", () => {
    const fake = demo("peterborough-lookalike");
    expect(buildResult({ url: fake.url, ...PETERBOROUGH }, fake.link).headline).toBe("Fake link. Don't pay.");
    const url = "https://parkeasy-ptbo.com/pay/1001";
    expect(buildResult({ url, ...PETERBOROUGH }, direct(url)).headline).toBe("Sketchy link. Don't pay.");
    const real = demo("peterborough-real");
    expect(buildResult({ url: real.url, ...PETERBOROUGH }, real.link).headline).toBe("Safe to pay.");
  });

  it("each demo code's result matches what it should say, at its place's own zone", () => {
    for (const code of DEMO_CODES) {
      const z = getPlace(code.placeId).zone;
      const r = buildResult({ url: code.url, lat: z.lat, lon: z.lon, accuracy: 0 }, code.link, { fromCache: true });
      expect(r.verdict, code.id).toBe(code.expect);
    }
  });

  it("'Go to the real site' comes from our list, never the scanned code", () => {
    const url = "https://parkeasy-ptbo.com/pay/1001";
    expect(buildResult({ url, ...PETERBOROUGH }, direct(url)).realSite?.url).toBe("https://hotspotparking.com");
    // A fake PayByPhone somewhere we don't check: point to the real PayByPhone.
    const fake = "https://paybyphone-parking.online/pay";
    expect(buildResult({ url: fake, ...NOWHERE }, direct(fake)).realSite?.url).toBe("https://www.paybyphone.com");
    // Nothing to point to: no button.
    expect(buildResult({ url, ...NOWHERE }, direct(url)).realSite).toBeNull();
  });
});

describe("parseCheckRequest", () => {
  it("needs a url, and trims it", () => {
    expect(parseCheckRequest(null)).toBeNull();
    expect(parseCheckRequest({})).toBeNull();
    expect(parseCheckRequest({ url: "   " })).toBeNull();
    expect(parseCheckRequest({ url: "a".repeat(MAX_URL_LENGTH + 1) })).toBeNull();
    expect(parseCheckRequest({ url: "  https://a.com  " })).toEqual({ url: "https://a.com" });
  });

  it("drops a broken location or photo instead of failing", () => {
    const r = parseCheckRequest({ url: "u", lat: "43", lon: -79, accuracy: 5, photo: "data:text/html;base64,PGI+" });
    expect(r).toEqual({ url: "u" });
  });

  it("keeps a good location and a JPEG photo", () => {
    const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const r = parseCheckRequest({ url: "u", lat: 43.5, lon: -79.6, accuracy: 12, photo });
    expect(r).toEqual({ url: "u", lat: 43.5, lon: -79.6, accuracy: 12, photo });
  });
});
