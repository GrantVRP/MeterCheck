import { describe, expect, it } from "vitest";
import { registry } from "@/lib/registry";
import { checkPlace } from "./place";
import { decide, type LinkFacts, type VerdictFacts } from "./verdict";

// Every city in the registry is checked now (Ontario-wide).
const MISSISSAUGA = checkPlace({ lat: 43.589, lon: -79.6441 }, { cityIds: registry.cities.map((c) => c.id) });
const PETERBOROUGH = checkPlace({ lat: 44.3048, lon: -78.3199 });
const TORONTO = checkPlace({ lat: 43.6534, lon: -79.3841 });
// Algonquin Park: no town we check is near.
const NOWHERE = checkPlace({ lat: 45.55, lon: -78.6 });

/** A link that was followed to the end with no redirects and nothing found. */
function plainLink(url: string, extra: Partial<LinkFacts> = {}): LinkFacts {
  return { chain: [url], chainComplete: true, chainNote: null, domainAgeDays: 3000, safeBrowsing: "clean", ...extra };
}

function facts(place: VerdictFacts["place"], url: string, extra: Partial<VerdictFacts> = {}): VerdictFacts {
  return { place, url, link: plainLink(url), sticker: null, ...extra };
}

// ---------- The seven tests from the brief ----------

describe("verdict rules (from the brief)", () => {
  it("1. Mississauga + any code = STOP, unless it's another town's real company (grey)", () => {
    for (const url of [
      "https://paybyphone-parking.online/pay?zone=CC01",
      "https://www.paybyphone.com/",
      "just some text",
    ]) {
      const d = decide(facts(MISSISSAUGA, url));
      expect(d.verdict, url).toBe("stop");
      expect(d.key).toBe("no-qr-city");
    }
    // A real HotSpot code: real, but for another town, or the phone's location is wrong.
    const d = decide(facts(MISSISSAUGA, "https://hotspotparking.com/"));
    expect(d.verdict).toBe("wrong-town");
    expect(d.key).toBe("other-town");
  });

  it("2. Peterborough + hotspotparking.com = SAFE", () => {
    const d = decide(facts(PETERBOROUGH, "https://hotspotparking.com/?zone=1001"));
    expect(d.verdict).toBe("safe");
    expect(d.brand).toBe("HotSpot");
    expect(decide(facts(PETERBOROUGH, "https://www.hotspotparking.com/")).verdict).toBe("safe");
  });

  it("3. Peterborough + hotspot-parking-pay.online = STOP", () => {
    const d = decide(facts(PETERBOROUGH, "https://hotspot-parking-pay.online/zone/1001"));
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("lookalike");
    expect(d.brand).toBe("HotSpot");
  });

  it("4. Peterborough + any website that isn't HotSpot = STOP (sketchy link)", () => {
    // Changed from the brief: Peterborough's codes only ever go to HotSpot.
    for (const url of ["https://parkeasy-ptbo.com/pay/1001", "https://example.org/", "http://parking.example.net/pay"]) {
      const d = decide(facts(PETERBOROUGH, url));
      expect(d.verdict, url).toBe("stop");
      expect(d.key, url).toBe("not-allowed");
      expect(d.reasons[0]).toBe("This is not HotSpot's website.");
    }
  });

  it("5. Unknown city = NOT SURE", () => {
    const d = decide(facts(NOWHERE, "https://hotspotparking.com/"));
    expect(d.verdict).toBe("unsure");
    expect(d.key).toBe("unknown-city");
  });

  it("6. Redirect from an allowed host to a look-alike = STOP", () => {
    const url = "https://hotspotparking.com/z/1001";
    const d = decide(
      facts(PETERBOROUGH, url, {
        link: plainLink(url, { chain: [url, "https://hotspotparkinq.com/pay"] }),
      }),
    );
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("redirect-lookalike");
  });

  it("7. Sticker detected with confidence 0.9 on an allowed host = STOP", () => {
    const d = decide(
      facts(PETERBOROUGH, "https://hotspotparking.com/?zone=1001", {
        sticker: { sticker: true, confidence: 0.9, reason: "A paper square over the sign." },
      }),
    );
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("sticker");
  });
});

// ---------- More cases ----------

describe("verdict rules (more)", () => {
  it("STOP when Google lists the website as dangerous", () => {
    const url = "https://parkeasy-ptbo.com/";
    expect(decide(facts(PETERBOROUGH, url, { link: plainLink(url, { safeBrowsing: "flagged" }) })).verdict).toBe("stop");
  });

  it("STOP for a look-alike even in a city we don't know", () => {
    expect(decide(facts(TORONTO, "https://paybyphone-parking.online/pay")).verdict).toBe("stop");
  });

  it("STOP for a brand-new website dressed up as a parking service", () => {
    // Extra words and a cheap ending alone score under the look-alike line; being 5 days old tips it over.
    // Not on our list, so sketchy; being 5 days old as well makes it a fake.
    const url = "https://ptbo-parking-pay.online/";
    expect(decide(facts(TORONTO, url)).key).toBe("not-allowed");
    const d = decide(facts(TORONTO, url, { link: plainLink(url, { domainAgeDays: 5 }) }));
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("lookalike");
    expect(d.reasons).toContain("The website is only 5 days old.");
  });

  it("a new website that pretends to be no one is sketchy, not called a fake", () => {
    const url = "https://parkeasy-ptbo.com/";
    const d = decide(facts(TORONTO, url, { link: plainLink(url, { domainAgeDays: 3 }) }));
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("not-allowed");
  });

  it("HotSpot's other websites count as HotSpot", () => {
    for (const url of ["https://www.htsp.ca/", "https://pay.hotspotparking.com/zone/1001"]) {
      const d = decide(facts(PETERBOROUGH, url));
      expect(d.verdict, url).toBe("safe");
      expect(d.brand).toBe("HotSpot");
    }
    const url = "https://hotspotparking.com/";
    expect(decide(facts(PETERBOROUGH, url, { link: plainLink(url, { chain: [url, "https://www.htsp.ca/"] }) })).verdict).toBe("safe");
  });

  it("a website that only starts with HotSpot's name is not HotSpot", () => {
    for (const url of ["https://hotspotparking.com.pay-now.xyz/", "https://hotspotparking.co/", "https://myhotspotparking.com/"]) {
      expect(decide(facts(PETERBOROUGH, url)).verdict, url).toBe("stop");
    }
  });

  it("never SAFE when we couldn't follow the redirects to the end", () => {
    const url = "https://hotspotparking.com/";
    const d = decide(facts(PETERBOROUGH, url, { link: plainLink(url, { chainComplete: false, chain: [] }) }));
    expect(d.verdict).toBe("unsure");
    expect(d.key).toBe("chain-incomplete");
  });

  it("never SAFE when an allowed host sends you somewhere unknown", () => {
    const url = "https://hotspotparking.com/";
    const d = decide(facts(PETERBOROUGH, url, { link: plainLink(url, { chain: [url, "https://example.org/"] }) }));
    expect(d.verdict).toBe("unsure");
    expect(d.key).toBe("redirect-elsewhere");
  });

  it("a redirect between HotSpot's own addresses is still SAFE", () => {
    const url = "https://hotspotparking.com/";
    const d = decide(facts(PETERBOROUGH, url, { link: plainLink(url, { chain: [url, "https://www.hotspotparking.com/"] }) }));
    expect(d.verdict).toBe("safe");
  });

  it("never SAFE if you'd end up on plain http", () => {
    expect(decide(facts(PETERBOROUGH, "http://hotspotparking.com/")).key).toBe("not-https");
  });

  it("http is fine when HotSpot itself sends it on to https, and we open the https address", () => {
    const url = "http://hotspotparking.com/";
    const d = decide(facts(PETERBOROUGH, url, { link: plainLink(url, { chain: [url, "https://hotspotparking.com/"] }) }));
    expect(d.verdict).toBe("safe");
    expect(d.safeUrl).toBe("https://hotspotparking.com/");
  });

  it("checks the zone once the real address is confirmed", () => {
    const place = { ...PETERBOROUGH, expectedUrl: "https://hotspotparking.com/zone/1001" };
    expect(decide(facts(place, "https://hotspotparking.com/zone/1001/")).verdict).toBe("safe");
    expect(decide(facts(place, "https://hotspotparking.com/zone/2002")).key).toBe("wrong-zone");
  });

  it("a sticker the photo check isn't sure about makes it NOT SURE", () => {
    const d = decide(
      facts(PETERBOROUGH, "https://hotspotparking.com/", { sticker: { sticker: true, confidence: 0.5, reason: "" } }),
    );
    expect(d.key).toBe("maybe-sticker");
  });

  it("another town's real company in Peterborough is grey Wrong town?, never SAFE", () => {
    const d = decide(facts(PETERBOROUGH, "https://www.paybyphone.com/"));
    expect(d.verdict).toBe("wrong-town");
    expect(d.key).toBe("other-town");
    expect(d.brand).toBe("PayByPhone");
    expect(d.reasons[0]).toMatch(/^This is PayByPhone's real website, used in [A-Z]/);
    expect(d.reasons[1]).toBe("Peterborough's parking signs use HotSpot.");
    expect(d.safeUrl).toBeNull();
  });

  it("a real company no town we check uses is STOP in Peterborough: the signs use HotSpot", () => {
    const d = decide(facts(PETERBOROUGH, "https://spothero.com/"));
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("official-other");
    expect(d.reasons[0]).toBe("This is SpotHero's website, but Peterborough's parking signs use HotSpot.");
  });

  it("a known sign's code names its own town", () => {
    const d = decide(facts(MISSISSAUGA, "https://hotspotparking.com/tapPoster/park/htspTap50"));
    expect(d.verdict).toBe("wrong-town");
    expect(d.otherTown).toBe("Peterborough");
  });

  it("a fake code is still a fake in another town, never grey", () => {
    for (const place of [MISSISSAUGA, TORONTO]) {
      expect(decide(facts(place, "https://hotspot-parking-pay.online/zone/1001")).verdict).toBe("stop");
    }
    const flagged = { link: plainLink("https://hotspotparking.com/", { safeBrowsing: "flagged" }) };
    expect(decide(facts(TORONTO, "https://hotspotparking.com/", flagged)).verdict).toBe("stop");
  });

  it("another company's real website is NOT SURE in a city we don't check", () => {
    expect(decide(facts(NOWHERE, "https://www.paybyphone.com/")).key).toBe("unknown-city");
  });

  it("text that isn't a web address is NOT SURE in Peterborough", () => {
    expect(decide(facts(PETERBOROUGH, "WIFI:S:cafe;T:WPA;P:secret;;")).key).toBe("not-web");
  });

  it("no location = NOT SURE", () => {
    expect(decide(facts(checkPlace(null), "https://hotspotparking.com/")).key).toBe("no-location");
  });

  it("reasons never use the banned words", () => {
    const urls = [
      "https://hotspot-parking-pay.online/",
      "https://hotspotparking.com.pay-now.xyz/",
      "https://xn--hotsptparking-xyz.com/",
      "https://203.0.113.9/pay",
      "https://bit.ly/abc",
    ];
    for (const place of [MISSISSAUGA, PETERBOROUGH, TORONTO]) {
      for (const url of urls) {
        for (const r of decide(facts(place, url)).reasons) {
          expect(r, r).not.toMatch(/\b(QR|URL|domain|phishing|malicious)\b/i);
        }
      }
    }
  });
});

describe("real Peterborough codes (decoded from published photos and Trent University)", () => {
  it("HotSpot Fast Tap signs are SAFE", () => {
    for (const url of [
      "https://hotspotparking.com/tapPoster/park/htspTap50", // downtown sign
      "https://hotspotparking.com/tapPoster/park/htspTap49", // Trent, zone 7777
      "https://hotspotparking.com/tapPoster/park/trentU001", // Trent Eco Lot, zone 3333
      "http://hotspotparking.com/tapPoster/park/htspTap114",
      "hotspotparking.com/tapPoster/park/htspTap50",
    ]) {
      const link = url.startsWith("http://") ? plainLink(url, { chain: [url, url.replace("http://", "https://")] }) : plainLink(url);
      expect(decide(facts(PETERBOROUGH, url, { link })).verdict, url).toBe("safe");
    }
  });

  it("Trent overnight guest codes (OPS-COM) are SAFE in Peterborough", () => {
    const d = decide(facts(PETERBOROUGH, "https://trentu.ops-com.com/permits/qrcode/reservation/684"));
    expect(d.verdict).toBe("safe");
    expect(d.brand).toBe("OPS-COM");
  });

  it("the City ticket page is SAFE only at its exact address", () => {
    expect(decide(facts(PETERBOROUGH, "https://secure35.ipayment.com/peterborough/my/0.htm")).verdict).toBe("safe");
    expect(decide(facts(PETERBOROUGH, "https://secure20.ipayment.com/peterborough/")).verdict).toBe("stop");
  });

  it("still names HotSpot as the parking service, not the ticket page", () => {
    expect(decide(facts(PETERBOROUGH, "https://parkeasy-ptbo.com/")).reasons[0]).toBe("This is not HotSpot's website.");
  });
});

describe("looking the address up in our list", () => {
  it("never SAFE for an address that isn't on the list, wherever you are", () => {
    for (const place of [NOWHERE, checkPlace(null)]) {
      const d = decide(facts(place, "https://parkeasy-ptbo.com/pay/1001"));
      expect(d.verdict).toBe("stop");
      expect(d.key).toBe("not-allowed");
      expect(d.reasons[0]).toBe("This is not a parking website we know.");
    }
  });

  it("a real company's website is NOT SURE when we don't know where you are", () => {
    const d = decide(facts(checkPlace(null), "https://hotspotparking.com/"));
    expect(d.verdict).toBe("unsure");
    expect(d.key).toBe("no-location");
    expect(d.brand).toBe("HotSpot");
  });

  it("reads a website name with no https:// in front", () => {
    expect(decide(facts(PETERBOROUGH, "hotspotparking.com")).verdict).toBe("safe");
    expect(decide(facts(PETERBOROUGH, "www.hotspotparking.com/z/1001")).safeUrl).toBe("https://www.hotspotparking.com/z/1001");
    expect(decide(facts(PETERBOROUGH, "hotspotparking.com.pay-now.xyz")).verdict).toBe("stop");
    expect(decide(facts(PETERBOROUGH, "just some text")).key).toBe("not-web");
  });

  it("an app store after a real company's link is fine; we open the company's own address", () => {
    const url = "https://hotspotparking.com/app";
    const store = "https://apps.apple.com/ca/app/hotspot-parking/id723185236";
    const d = decide(facts(PETERBOROUGH, url, { link: plainLink(url, { chain: [url, store] }) }));
    expect(d.verdict).toBe("safe");
    expect(d.safeUrl).toBe(url);
  });

  it("an app store as the code itself is sketchy", () => {
    expect(decide(facts(PETERBOROUGH, "https://apps.apple.com/ca/app/parking/id1")).verdict).toBe("stop");
  });

  it("a private car park's company counts where it really operates", () => {
    const place = { ...PETERBOROUGH, allowedHosts: [...PETERBOROUGH.allowedHosts, "honkmobile.com"] };
    const d = decide(facts(place, "https://parking.honkmobile.com/zone/123"));
    expect(d.verdict).toBe("safe");
    expect(d.brand).toBe("HONK");
    expect(d.reasons).toContain("HONK is a parking service used in Peterborough.");
    // ...and is grey Wrong town? where it doesn't.
    expect(decide(facts(PETERBOROUGH, "https://parking.honkmobile.com/zone/123")).key).toBe("other-town");
  });
});

describe("the City's own website", () => {
  it("is NOT SURE when we don't know where you are", () => {
    expect(decide(facts(checkPlace(null), "https://www.peterborough.ca/parking")).key).toBe("city-site");
  });
  it("is NOT SURE with a fair reason, not called unknown", () => {
    const d = decide(facts(PETERBOROUGH, "https://www.peterborough.ca/parking"));
    expect(d.verdict).toBe("unsure");
    expect(d.key).toBe("city-site");
  });
  it("is not a look-alike", () => {
    expect(decide(facts(TORONTO, "https://www.mississauga.ca/")).verdict).toBe("unsure");
  });
});

// ---------- Ontario-wide list ----------

const at = (lat: number, lon: number) => checkPlace({ lat, lon });
const OTTAWA = at(45.4215, -75.6972);
const OAKVILLE = at(43.4475, -79.6668);
const ELORA = at(43.6858, -80.4313);
const KINGSTON = at(44.2312, -76.486);
const LONDON = at(42.9849, -81.2453);
const PICTON = at(44.0075, -77.1408);

describe("Ontario-wide list", () => {
  it("each town's own company is SAFE there, and only there", () => {
    const cases: [VerdictFacts["place"], string][] = [
      [TORONTO, "https://mobilepay.greenp.com/"],
      [KINGSTON, "https://parking.honkmobile.com/hourly/zones/5790"],
      [LONDON, "https://parking.honkmobile.com/hourly/zones/2170"],
      [at(43.2557, -79.8711), "https://park.passportparking.com/park/"], // Hamilton
      [at(43.8361, -79.5083), "https://parkedin.com/"], // Vaughan
      [at(44.3894, -79.6903), "https://hotspotparking.com/tapPoster/park/barrie1"], // Barrie
    ];
    for (const [place, url] of cases) {
      expect(decide(facts(place, url)).verdict, `${place.cityName} ${url}`).toBe("safe");
    }
    // HotSpot in a HONK town, HONK in a HotSpot town: grey Wrong town?, never safe.
    expect(decide(facts(KINGSTON, "https://hotspotparking.com/")).verdict).toBe("wrong-town");
    expect(decide(facts(PETERBOROUGH, "https://parking.honkmobile.com/")).verdict).toBe("wrong-town");
  });

  it("addresses that look like a company's but aren't theirs are never safe", () => {
    const fakes = [
      "https://paybyphone.ca/", "https://paybyphone.net/", "https://honkmobile.ca/", "https://honkmobile.net/",
      "https://honk.ca/", "https://htsp.com/", "https://parkedin.ca/", "https://passportparking.ca/",
      "https://indigoparking.com/", "https://impark.ca/", "https://parklink.ca/", "https://poybyphone.online/",
      "https://greenp-parking.com/", "https://hotspotparking.co/", "https://honkmobile.com.pay-now.xyz/",
    ];
    for (const place of [PETERBOROUGH, TORONTO, OTTAWA, KINGSTON, LONDON, NOWHERE, checkPlace(null)]) {
      for (const url of fakes) {
        expect(decide(facts(place, url)).verdict, `${place.label} ${url}`).toBe("stop");
      }
    }
  });

  it("Ottawa: no codes on City machines, but its campus car parks are real", () => {
    expect(decide(facts(OTTAWA, "https://m.paybyphone.com/")).key).toBe("no-qr-city");
    expect(decide(facts(OTTAWA, "https://poybyphone.online/")).verdict).toBe("stop");
    expect(decide(facts(OTTAWA, "https://hotspotparking.com/tapPoster/park/carletonU3")).verdict).toBe("safe");
  });

  it("Oakville: HONK is app only, but the ticket page is real", () => {
    expect(decide(facts(OAKVILLE, "https://parking.honkmobile.com/hourly/zones/1")).key).toBe("no-qr-city");
    expect(decide(facts(OAKVILLE, "https://oakville.aimsparking.com/tickets/")).verdict).toBe("safe");
  });

  it("a town with free street parking: an unknown payment code is a fake, another town's company is grey", () => {
    const d = decide(facts(ELORA, "https://elora-parking-pay.com/"));
    expect(d.verdict).toBe("stop");
    expect(d.key).toBe("free-parking");
    expect(decide(facts(ELORA, "https://parking.honkmobile.com/")).verdict).toBe("wrong-town");
    expect(decide(facts(ELORA, "https://www.grandriver.ca/epass")).verdict).toBe("safe");
  });

  it("Ontario Parks and Parks Canada are real anywhere in Ontario", () => {
    expect(decide(facts(PICTON, "https://reservations.ontarioparks.ca/create-booking")).verdict).toBe("safe");
    expect(decide(facts(at(45.2531, -81.6645), "https://reservation.pc.gc.ca/")).verdict).toBe("safe"); // Tobermory
  });

  it("near a border, a real code from next door is grey Wrong town?, never SAFE or STOP", () => {
    const spot = at(43.458, -80.505); // between downtown Kitchener and uptown Waterloo
    const other = spot.cityId === "waterloo-on" ? "https://park.passportparking.com/" : "https://parking.honkmobile.com/";
    const d = decide(facts(spot, other));
    expect(d.verdict).toBe("wrong-town");
    expect(d.key).toBe("near-border");
  });

  it("any town's own website is NOT SURE, never SAFE", () => {
    expect(decide(facts(KINGSTON, "https://www.cityofkingston.ca/residents/parking")).key).toBe("city-site");
    expect(decide(facts(TORONTO, "https://www.mississauga.ca/")).key).toBe("city-site");
    expect(decide(facts(MISSISSAUGA, "https://www.mississauga.ca/")).key).toBe("city-site");
  });

  it("a shared payment service is only real where a town uses it", () => {
    // Paymentus: St. Catharines uses it for tickets; Toronto doesn't.
    const url = "https://ipn.paymentus.com/rotp/stca";
    expect(decide(facts(at(43.1594, -79.2469), url)).verdict).toBe("safe");
    expect(decide(facts(TORONTO, url)).verdict).toBe("stop");
  });
});
