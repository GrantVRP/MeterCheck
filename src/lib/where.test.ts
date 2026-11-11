// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import { describe, expect, it } from "vitest";
import { buildResult } from "./checks/result";
import type { LinkFacts } from "./checks/verdict";
import { hasZones, helpContacts, machineNote, payApps, townFrom, type TownInput } from "./where";

const direct = (url: string): LinkFacts => ({ chain: [url], chainComplete: true, chainNote: null, domainAgeDays: 3000, safeBrowsing: "clean" });
const checkAt = (url: string, lat: number, lon: number) => buildResult({ url, lat, lon, accuracy: 10 }, direct(url));
const base: TownInput = { result: null, spot: null, fix: null, useGps: false, placeId: "downtown-peterborough" };
const fixAt = (lat: number, lon: number) => ({ lat, lon, accuracy: 10, at: Date.now() });

describe("which town the help and pay screens are about", () => {
  it("Toronto check: Toronto's numbers and Green P, never Peterborough's", () => {
    const result = checkAt("https://bad-parking.example/pay", 43.6534, -79.3841);
    const town = townFrom({ ...base, result, spot: { lat: 43.6534, lon: -79.3841 } });
    expect(town.city?.id).toBe("toronto-on");
    expect(helpContacts(town).map((c) => c.who).join()).not.toMatch(/Peterborough|HotSpot/);
    const apps = payApps(town);
    expect(apps.map((a) => a.name)).toEqual(["Green P"]);
    expect(apps[0].web?.url).toBe("https://www.greenp.com");
    expect(town.spot).toEqual({ lat: 43.6534, lon: -79.3841 });
  });

  it("Peterborough picked by hand: HotSpot app and the City's parking line", () => {
    const town = townFrom(base);
    expect(town.city?.id).toBe("peterborough-on");
    expect(town.zone).toBe("SAMPLE-1001");
    expect(payApps(town)[0].name).toBe("HotSpot");
    expect(payApps(town)[0].ios).toMatch(/^https:\/\/apps\.apple\.com\//);
    expect(helpContacts(town).map((c) => c.who)).toContain("City of Peterborough Parking Services");
    expect(machineNote(town).headline).toBe("Or pay at the machine");
  });

  it("GPS in Kingston, no check yet: HONK", () => {
    const town = townFrom({ ...base, useGps: true, fix: fixAt(44.2312, -76.486) });
    expect(town.city?.id).toBe("kingston-on");
    expect(payApps(town).map((a) => a.name)).toContain("HONK");
  });

  it("Ottawa: the PayByPhone app (Ottawa has no codes on its machines)", () => {
    const town = townFrom({ ...base, useGps: true, fix: fixAt(45.4215, -75.6972) });
    expect(payApps(town).map((a) => a.web?.url)).toContain("https://www.paybyphone.com");
  });

  it("a town with free street parking says so", () => {
    const town = townFrom({ ...base, useGps: true, fix: fixAt(43.6858, -80.4313) }); // Elora
    expect(machineNote(town).headline).toBe("Street parking here is free");
  });

  it("somewhere we don't check: numbers that work anywhere, no app", () => {
    const result = checkAt("https://bad-parking.example/pay", 45.55, -78.6); // Algonquin Park
    const town = townFrom({ ...base, result, spot: { lat: 45.55, lon: -78.6 } });
    expect(town.city).toBeNull();
    expect(helpContacts(town).map((c) => c.who)).toEqual(["Canadian Anti-Fraud Centre", "Your bank or card company"]);
    expect(payApps(town)).toEqual([]);
    expect(machineNote(town).headline).toBe("Pay at the machine");
  });

  it("GPS on but no reading yet: we don't guess a town", () => {
    const town = townFrom({ ...base, useGps: true });
    expect(town.city).toBeNull();
    expect(helpContacts(town)[0].who).toBe("Canadian Anti-Fraud Centre");
  });

  it("'Pay without scanning' from Home ignores an older check", () => {
    const result = checkAt("https://bad-parking.example/pay", 43.6534, -79.3841); // Toronto
    const town = townFrom({ ...base, result, ignoreResult: true });
    expect(town.city?.id).toBe("peterborough-on");
  });
});

describe("Pay without scanning: open the app, then type the sign's zone number there", () => {
  it("towns whose app uses zone numbers", () => {
    for (const placeId of ["downtown-peterborough", "streetsville"]) {
      expect(hasZones(townFrom({ ...base, placeId })), placeId).toBe(true);
    }
    // Toronto by GPS: Green P zones.
    expect(hasZones(townFrom({ ...base, useGps: true, fix: fixAt(43.6534, -79.3841) }))).toBe(true);
  });

  it("downtown Mississauga has no zone numbers: pay at the machine", () => {
    expect(hasZones(townFrom({ ...base, placeId: "downtown-mississauga" }))).toBe(false);
  });

  it("free street parking, or a town we don't know: no zone numbers", () => {
    expect(hasZones(townFrom({ ...base, useGps: true, fix: fixAt(43.6858, -80.4313) }))).toBe(false); // Elora
    expect(hasZones(townFrom({ ...base, useGps: true, fix: fixAt(45.55, -78.6) }))).toBe(false); // Algonquin Park
    expect(hasZones(townFrom({ ...base, useGps: true }))).toBe(false); // no reading yet
  });
});
