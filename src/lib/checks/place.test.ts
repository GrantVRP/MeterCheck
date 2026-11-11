// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import { describe, expect, it } from "vitest";
import { checkPlace, nearestTown } from "./place";
import { confirmedExpectedUrl, getCity, registry, townsUsing, townUsesCompany } from "@/lib/registry";

// Every city in the registry is switched on now. ALL is kept for tests that must not depend on that.
const ALL = { cityIds: registry.cities.map((c) => c.id) };

describe("checkPlace (every city switched on)", () => {
  it("finds Downtown Mississauga, which never uses codes", () => {
    const p = checkPlace({ lat: 43.589, lon: -79.6441, accuracy: 8 }, ALL);
    expect(p.status).toBe("found");
    expect(p.cityId).toBe("mississauga-on");
    expect(p.placeId).toBe("downtown-mississauga");
    expect(p.label).toBe("Downtown Mississauga");
    expect(p.usesQr).toBe(false);
    // PayByPhone is app only here: the City says it never puts codes on its machines.
    expect(p.allowedHosts).not.toContain("paybyphone.com");
    expect(p.zone).toBe("SAMPLE-DT-01");
    expect(p.accuracyM).toBe(8);
  });

  it("finds Streetsville as its own place", () => {
    const p = checkPlace({ lat: 43.5813, lon: -79.7111 }, ALL);
    expect(p.placeId).toBe("streetsville");
    expect(p.label).toBe("Streetsville");
    expect(p.zone).toBe("SAMPLE-ST-01");
  });

  it("uses the city default for other parts of Mississauga", () => {
    for (const spot of [
      { lat: 43.5512, lon: -79.5848 }, // Port Credit
      { lat: 43.5915, lon: -79.788 }, // Lisgar GO
      { lat: 43.6777, lon: -79.6248 }, // Pearson airport
    ]) {
      const p = checkPlace(spot, ALL);
      expect(p.cityId).toBe("mississauga-on");
      expect(p.placeId).toBe("downtown-mississauga");
      expect(p.label).toBe("Mississauga");
      expect(p.zone).toBeNull();
    }
  });

});

describe("checkPlace (Ontario-wide, as it is now)", () => {
  it("checks Mississauga", () => {
    const p = checkPlace({ lat: 43.589, lon: -79.6441 });
    expect(p.status).toBe("found");
    expect(p.cityId).toBe("mississauga-on");
  });

  it("finds Peterborough at Trent University (HackTrent)", () => {
    const p = checkPlace({ lat: 44.357, lon: -78.29 });
    expect(p.status).toBe("found");
    expect(p.cityId).toBe("peterborough-on");
    expect(p.label).toBe("Peterborough");
  });

  it("finds Peterborough, its allowed hosts, and a zone within 150 m", () => {
    const p = checkPlace({ lat: 44.3057, lon: -78.3199 }); // ~100 m north of SAMPLE-1001
    expect(p.cityId).toBe("peterborough-on");
    expect(p.placeId).toBe("downtown-peterborough");
    expect(p.usesQr).toBe(true);
    expect(p.allowedHosts).toContain("hotspotparking.com");
    expect(p.zone).toBe("SAMPLE-1001");
    expect(p.zoneDistanceM).toBeGreaterThan(80);
    expect(p.zoneDistanceM).toBeLessThan(120);
    // Still TODO_CONFIRM in the registry, so the check must fall back to allowed hosts.
    expect(p.expectedUrl).toBeNull();
  });

  it("gives no zone when the nearest one is over 150 m away", () => {
    const p = checkPlace({ lat: 44.3066, lon: -78.3199 }); // ~200 m north of SAMPLE-1001
    expect(p.cityId).toBe("peterborough-on");
    expect(p.zone).toBeNull();
  });

  it("finds towns all over Ontario", () => {
    for (const [spot, id] of [
      [{ lat: 43.6534, lon: -79.3841 }, "toronto-on"], // City Hall
      [{ lat: 43.6858, lon: -79.7599 }, "brampton-on"],
      [{ lat: 43.4475, lon: -79.6668 }, "oakville-on"],
      [{ lat: 44.4228, lon: -78.2711 }, "peterborough-county-on"], // Lakefield, just north of Peterborough
      [{ lat: 45.4215, lon: -75.6972 }, "ottawa-on"], // Parliament Hill
      [{ lat: 44.2312, lon: -76.486 }, "kingston-on"],
      [{ lat: 42.9849, lon: -81.2453 }, "london-on"],
      [{ lat: 43.4516, lon: -80.4925 }, "kitchener-on"], // downtown Kitchener
      [{ lat: 43.4643, lon: -80.5204 }, "waterloo-on"], // uptown Waterloo
      [{ lat: 43.6858, lon: -80.4313 }, "centre-wellington-on"], // Elora
      [{ lat: 46.4917, lon: -80.993 }, "greater-sudbury-on"],
      [{ lat: 48.3809, lon: -89.2477 }, "thunder-bay-on"],
      [{ lat: 42.3149, lon: -83.0364 }, "windsor-on"],
    ] as const) {
      const p = checkPlace(spot);
      expect(p.status, id).toBe("found");
      expect(p.cityId, id).toBe(id);
    }
  });

  it("knows towns that don't charge for street parking", () => {
    const p = checkPlace({ lat: 43.6858, lon: -80.4313 }); // Elora
    expect(p.freeParking).toBe(true);
    expect(p.usesQr).toBe(false);
  });

  it("lists the town next door near a border", () => {
    // Between downtown Kitchener and uptown Waterloo, both circles cover the spot.
    const p = checkPlace({ lat: 43.458, lon: -80.505 });
    const ids = [p.cityId, ...p.nearby.map((n) => n.cityId)];
    expect(ids).toContain("kitchener-on");
    expect(ids).toContain("waterloo-on");
  });

  it("says where you are is not checked yet, far from any town we know", () => {
    const p = checkPlace({ lat: 45.55, lon: -78.6 }); // Algonquin Park
    expect(p.status).toBe("unknown-city");
    expect(p.cityId).toBeNull();
  });

  it("handles a missing or broken location", () => {
    expect(checkPlace(null).status).toBe("no-location");
    expect(checkPlace({ lat: Number.NaN, lon: -79 }).status).toBe("no-location");
    expect(checkPlace({ lat: 200, lon: 0 }).status).toBe("no-location");
  });
});

describe("confirmedExpectedUrl", () => {
  it("ignores TODO_CONFIRM and anything that isn't https", () => {
    const base = { zone: "Z", label: "Z", lat: 0, lon: 0 };
    expect(confirmedExpectedUrl({ ...base, expected_url: "TODO_CONFIRM" })).toBeNull();
    expect(confirmedExpectedUrl({ ...base, expected_url: "http://hotspotparking.com/1001" })).toBeNull();
    expect(confirmedExpectedUrl({ ...base })).toBeNull();
    expect(confirmedExpectedUrl({ ...base, expected_url: "https://hotspotparking.com/1001" })).toBe(
      "https://hotspotparking.com/1001",
    );
  });
});

describe("which towns use a company", () => {
  it("HotSpot is used in Peterborough, not Toronto", () => {
    const ids = townsUsing("HotSpot").map((c) => c.id);
    expect(ids).toContain("peterborough-on");
    expect(ids).not.toContain("toronto-on");
  });

  it("a town's own app counts, even with no codes on its machines", () => {
    expect(townUsesCompany(getCity("ottawa-on"), "PayByPhone")).toBe(true);
    expect(townUsesCompany(getCity("peterborough-on"), "PayByPhone")).toBe(false);
    expect(townUsesCompany(null, "HotSpot")).toBe(false);
  });

  it("nearestTown picks the closest one (the first, if we have no location)", () => {
    const towns = [getCity("peterborough-on")!, getCity("toronto-on")!];
    expect(nearestTown({ lat: 44.3, lon: -78.32 }, towns)?.id).toBe("peterborough-on");
    expect(nearestTown({ lat: 43.6, lon: -79.6 }, towns)?.id).toBe("toronto-on");
    expect(nearestTown(null, towns)?.id).toBe("peterborough-on");
    expect(nearestTown({ lat: 44.3, lon: -78.32 }, [])).toBeNull();
  });
});
