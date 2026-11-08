import { describe, expect, it } from "vitest";
import { registrableDomain, splitHost } from "./address";
import { editDistance, ownerOf, scoreLookalike } from "./lookalike";

describe("splitHost", () => {
  it("finds the registered name", () => {
    expect(splitHost("www.hotspotparking.com")).toEqual({
      sub: "www",
      label: "hotspotparking",
      ending: "com",
      domain: "hotspotparking.com",
    });
    expect(registrableDomain("pay.city.on.ca")).toBe("city.on.ca");
    expect(registrableDomain("hotspotparking.com.pay-now.xyz")).toBe("pay-now.xyz");
  });
});

describe("editDistance", () => {
  it("counts single-letter changes", () => {
    expect(editDistance("hotspotparking", "hotspotparkinq")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("scoreLookalike", () => {
  it("real company websites score 0", () => {
    for (const h of ["hotspotparking.com", "www.hotspotparking.com", "paybyphone.com", "www.paybyphone.com", "htsp.ca", "hotspotparking.ca", "hotspotparking.us", "trentu.ops-com.com"]) {
      expect(scoreLookalike(h).score, h).toBe(0);
    }
    expect(ownerOf("www.paybyphone.com")).toBe("PayByPhone");
    expect(ownerOf("example.com")).toBeNull();
  });

  it("catches the common tricks", () => {
    const cases: [string, number][] = [
      ["hotspot-parking-pay.online", 0.9], // brand + extra words + odd ending
      ["paybyphone-parking.online", 0.9],
      ["hotspotparkinq.com", 0.9], // one letter swapped
      ["h0tspotparking.com", 0.85], // 0 for o
      ["hotspotparking.net", 0.8], // same name, different ending (HotSpot really owns .com, .ca and .us)
      ["hotspotparking.com.pay-now.xyz", 0.9], // real name in front
      ["paybyphone.secure-pay.top", 0.9],
      ["xn--hotsptparking-abc.com", 0.7], // other alphabets
      ["203.0.113.9", 0.7], // bare number address
    ];
    for (const [host, atLeast] of cases) {
      expect(scoreLookalike(host).score, host).toBeGreaterThanOrEqual(atLeast);
    }
    expect(scoreLookalike("hotspot-parking-pay.online").nearest).toBe("hotspotparking.com");
    expect(scoreLookalike("paybyphone-parking.online").brand).toBe("PayByPhone");
  });

  it("leaves ordinary websites alone", () => {
    for (const h of ["parkeasy-ptbo.com", "greenpeace.org", "peterborough.ca", "example.com", "honkytonk.com"]) {
      expect(scoreLookalike(h).score, h).toBeLessThan(0.6);
    }
  });

  it("a short link is suspicious but not a fake on its own", () => {
    const s = scoreLookalike("bit.ly").score;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.6);
  });
});
