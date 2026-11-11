// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// The 13 towns researched in depth on 2026-11-08: what a code there should get.
import { describe, expect, it } from "vitest";
import { getCity } from "@/lib/registry";
import { hasZones, machineNote, payApps, townFrom } from "@/lib/where";
import { checkPlace, townCentre } from "./place";
import { decide, type LinkFacts } from "./verdict";

const plain = (url: string): LinkFacts => ({ chain: [url], chainComplete: true, chainNote: null, domainAgeDays: 3000, safeBrowsing: "clean" });
const inTown = (id: string) => {
  const p = checkPlace(townCentre(getCity(id)!));
  expect(p.cityId, id).toBe(id);
  return p;
};
const verdict = (id: string, url: string) => decide({ place: inTown(id), url, link: plain(url), sticker: null });
const town = (id: string) => {
  const c = townCentre(getCity(id)!);
  return townFrom({ result: null, spot: null, fix: { ...c, accuracy: 10, at: Date.now() }, useGps: true, placeId: "downtown-peterborough" });
};

describe("towns researched in depth", () => {
  it("Ajax: the Town's gtechna site is real; its own pay page gets Not sure; no zone numbers", () => {
    expect(verdict("ajax-on", "https://ajax.gtechna.net/permit-portal/public/permit_request_visitor.xhtml?rrid=1920").verdict).toBe("safe");
    expect(verdict("ajax-on", "https://ajax.ca/parkandpay").key).toBe("city-site");
    expect(verdict("ajax-on", "https://ajax-parking-pay.com/").verdict).toBe("stop");
    expect(hasZones(town("ajax-on"))).toBe(false);
    expect(machineNote(town("ajax-on")).headline).toBe("Pay online only");
    expect(payApps(town("ajax-on"))[0].web?.url).toBe("https://ajax.ca/parkandpay");
  });

  it("Oro-Medonte: HONK is real, with zone numbers; Jotform only at HONK's exact address", () => {
    expect(verdict("oro-medonte-on", "https://parking.honkmobile.com/hourly/zones/6871").verdict).toBe("safe");
    expect(verdict("oro-medonte-on", "https://honk.jotform.com/243254939834972").verdict).toBe("safe");
    expect(verdict("oro-medonte-on", "https://form.jotform.com/123").verdict).not.toBe("safe");
    expect(hasZones(town("oro-medonte-on"))).toBe(true);
  });

  it("Fort Erie: Precise ParkLink (Parkedin) is real; pay by plate, so no zone button", () => {
    expect(verdict("fort-erie-on", "https://parkedin.com/").verdict).toBe("safe");
    expect(verdict("fort-erie-on", "https://ipass.preciserd.com/v2/Register?siteid=690").verdict).toBe("safe");
    expect(hasZones(town("fort-erie-on"))).toBe(false);
  });

  it("machine-only towns: an unknown code is a fake", () => {
    for (const id of ["brockville-on", "sarnia-on", "georgina-on", "innisfil-on", "chatham-kent-on", "perth-on"]) {
      const d = verdict(id, "https://pay-parking-now.com/zone/1");
      expect(d.verdict, id).toBe("stop");
      expect(d.key, id).toBe("no-qr-city");
    }
  });

  it("free-parking towns: an unknown code is a fake", () => {
    for (const id of ["aurora-on", "hawkesbury-on", "dryden-on", "south-huron-on"]) {
      expect(verdict(id, "https://pay-parking-now.com/zone/1").key, id).toBe("free-parking");
    }
  });

  it("a town's exact ticket page never makes the rest of that company real there", () => {
    // Sarnia pays tickets on a Passport address, but has no Passport parking.
    expect(verdict("sarnia-on", "https://sarnia.ezpayca.com/").verdict).toBe("safe");
    // A real Passport parking code there is grey: real, but not for Sarnia.
    expect(verdict("sarnia-on", "https://passportparking.com/").verdict).toBe("wrong-town");
    // Perth and Dryden: only their own OPS-COM address.
    expect(verdict("perth-on", "https://perth.parkadmin.com/").verdict).toBe("safe");
    expect(verdict("perth-on", "https://fleming.parkadmin.com/").verdict).not.toBe("safe");
    expect(verdict("dryden-on", "https://dryden.ops-com.com/").verdict).toBe("safe");
  });

  it("each town names its own by-law or parking office first for help", () => {
    for (const id of ["ajax-on", "aurora-on", "brockville-on", "chatham-kent-on", "dryden-on", "fort-erie-on", "georgina-on",
      "hawkesbury-on", "innisfil-on", "oro-medonte-on", "perth-on", "sarnia-on", "south-huron-on"]) {
      const first = getCity(id)!.report_to[0];
      expect(first.who, id).not.toBe("Canadian Anti-Fraud Centre");
      expect(first.phone, id).toMatch(/\d{3}-\d{3}-\d{4}/);
    }
  });
});
