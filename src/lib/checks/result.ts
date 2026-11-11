// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// Turns the three checks into one result for the verdict screen.
// Pure, so the server uses it and the phone can use it when it's offline.

import type { CheckRequest, CheckResult, StickerResult } from "@/lib/types";
import { getPlace } from "@/lib/places";
import { getProvider } from "@/lib/providers";
import { cityCompanies, coverageSentence, getCity, LIVE_CITY_IDS, liveCityNames } from "@/lib/registry";
import { headlineFor } from "@/lib/words";
import { hostOf, parseWebUrl } from "./address";
import { checkPlace, type PlaceCheck } from "./place";
import { decide, type Decision, type LinkFacts, type ReasonKey } from "./verdict";

export { hostOf };

/** Used when nothing could be looked up (e.g. the phone is offline). Never leads to SAFE. */
export const NOT_LOOKED_UP: LinkFacts = {
  chain: [],
  chainComplete: false,
  chainNote: "Not looked up: Meter Check could not reach its server.",
  domainAgeDays: null,
  safeBrowsing: "skipped",
};

export function placeOf(req: CheckRequest): PlaceCheck {
  return checkPlace(req.lat != null && req.lon != null ? { lat: req.lat, lon: req.lon, accuracy: req.accuracy } : null);
}

const PAY_ANOTHER_WAY = "so it is safer to pay another way.";

/** One calm sentence for each kind of verdict. An AI-written sentence can replace it in Phase 4; this is the fallback. */
export function fallbackSentence(d: Decision, place: PlaceCheck): string {
  const city = place.cityName ?? "this city";
  const brand = d.brand;
  const real = place.companies.join(" or ") || "the real parking service";
  const where = place.areaName
    ? `You're in ${place.areaName}.`
    : LIVE_CITY_IDS.length <= 3
      ? `You're outside ${liveCityNames()}.`
      : "";
  const sentences: Record<ReasonKey, string> = {
    "no-qr-city": `${city} never puts codes on its parking machines, so this one is fake.`,
    "free-parking": `${city} doesn't charge for street parking, so its signs have no payment codes. Don't pay through this code.`,
    "near-border": `This code goes to ${brand ?? "a real parking service"}, used next door in ${d.otherTown ?? place.nearby[0]?.cityName ?? "another town"}. You may be near the edge of ${city}, or your location may be wrong.`,
    "other-town": otherTownSentence(d, place, city, real),
    "safe-browsing": "Google has warned that this website is dangerous.",
    lookalike: brand
      ? `This code goes to a website that pretends to be ${brand}.`
      : "This code goes to a fake website made to look real.",
    "redirect-lookalike": brand
      ? `This code sends you on to a website that pretends to be ${brand}.`
      : "This code sends you on to a fake website.",
    sticker: "Someone stuck a fake code over the real sign.",
    safe:
      brand && !place.companies.includes(brand)
        ? `This code goes to ${brand}, a real parking service used in ${city}.`
        : `This code goes to ${brand ?? "the real parking service"}, the real parking service for ${city}.`,
    "no-location": `We couldn't tell where you are, ${PAY_ANOTHER_WAY}`,
    "unknown-city": `${where} ${coverageSentence()} Pay at the machine or in the city's official app.`.trim(),
    "not-web": `This code doesn't go to a parking website, ${PAY_ANOTHER_WAY}`,
    "city-site": `This code goes to the City's own website, not a place to pay, ${PAY_ANOTHER_WAY}`,
    "official-other": place.companies.length
      ? `This code goes to ${brand}, but ${city}'s parking signs use ${real}. Don't pay through this code.`
      : `This code goes to ${brand}, but we don't know of ${brand} parking in ${city}. Don't pay through this code.`,
    "not-allowed":
      place.status !== "found"
        ? "This code does not go to any parking service we know."
        : place.companies.length
          ? `This code does not go to ${real}, ${city}'s real parking service.`
          : `This code does not go to a parking service used in ${city}.`,
    "not-https": `We can't be sure where this code goes, ${PAY_ANOTHER_WAY}`,
    "wrong-zone": `This code goes to ${brand ?? "the parking service"}, but not to this zone, ${PAY_ANOTHER_WAY}`,
    "chain-incomplete": `We couldn't follow where this code goes, ${PAY_ANOTHER_WAY}`,
    "redirect-elsewhere": `This code sends you on to a website we don't know, ${PAY_ANOTHER_WAY}`,
    "maybe-sticker": `There might be a sticker on this sign, ${PAY_ANOTHER_WAY}`,
  };
  return sentences[d.key];
}

/** Grey "Wrong town?": a real company's code, but for another town. */
function otherTownSentence(d: Decision, place: PlaceCheck, city: string, real: string): string {
  const brand = d.brand ?? "a real parking company";
  if (!d.otherTown) return `This code goes to ${brand}, a real parking company, but not one ${city} uses. Your location may be wrong.`;
  const goes = `This code goes to ${brand}, used in ${d.otherTown}.`;
  if (place.usesQr === false) {
    return place.freeParking
      ? `${goes} You're in ${city}, where street parking is free. Your location may be wrong.`
      : `${goes} You're in ${city}, where machines have no codes. Your location may be wrong.`;
  }
  return place.companies.length
    ? `${goes} ${city}'s signs use ${real}. Your location may be wrong.`
    : `${goes} You're in ${city}. Your location may be wrong.`;
}

/**
 * Where "Go to the real site" should go: the place's real site, else the city's
 * own parking company, else the company a fake pretends to be. Always from our
 * own list, never from the scanned code.
 */
export function realSiteFor(place: PlaceCheck, d: Decision): { url: string; label: string } | null {
  const label = (url: string) => new URL(url).hostname.replace(/^www\./, "");
  if (place.placeId) return getPlace(place.placeId).realSite;
  const city = getCity(place.cityId);
  const company = getProvider(city ? cityCompanies(city)[0] : d.brand);
  if (company?.website) return { url: company.website, label: label(company.website) };
  if (city?.official_page) return { url: city.official_page, label: label(city.official_page) };
  return null;
}

export function buildResult(
  req: CheckRequest,
  link: LinkFacts,
  opts: { offline?: boolean; fromCache?: boolean; sticker?: StickerResult | null } = {},
): CheckResult {
  const place = placeOf(req);
  const decision = decide({ place, url: req.url, link, sticker: opts.sticker ?? null });

  let sentence = fallbackSentence(decision, place);
  let reasons = decision.reasons;
  // Offline and not sure: say so plainly, instead of blaming the address.
  if (opts.offline && decision.verdict === "unsure" && decision.key !== "no-location" && decision.key !== "unknown-city") {
    sentence = `We couldn't check this code right now, ${PAY_ANOTHER_WAY}`;
    reasons = ["Meter Check could not reach its server.", ...reasons];
  }

  const scannedUrl = parseWebUrl(req.url);
  const lookalike =
    decision.verdict === "safe"
      ? { score: 0, nearest: scannedUrl?.hostname ?? null, signals: [] }
      : decision.lookalike && {
          score: decision.lookalike.score,
          nearest: decision.lookalike.nearest,
          signals: decision.lookalike.signals,
        };

  return {
    verdict: decision.verdict,
    headline: headlineFor(decision.verdict, decision.key),
    realSite: realSiteFor(place, decision),
    sentence,
    reasons,
    placeId: place.placeId,
    cityId: place.cityId,
    zone: place.zone,
    scanned: { url: req.url, host: hostOf(req.url) },
    // Only SAFE gets an address to continue to: the one we checked, never anything else.
    safeUrl: decision.safeUrl,
    details: {
      cityUsesQr: place.usesQr,
      freeParking: place.freeParking,
      domainAgeDays: link.domainAgeDays,
      redirects: link.chain,
      chainNote: link.chainNote,
      lookalike,
      safeBrowsing: link.safeBrowsing,
      sticker: opts.sticker ?? null,
      place: {
        label: place.label,
        source: place.status === "no-location" ? "none" : req.accuracy === 0 ? "picked" : "gps",
        zoneDistanceM: place.zoneDistanceM,
        accuracyM: place.accuracyM,
      },
    },
    ...(opts.fromCache ? { fromCache: true } : {}),
    checkedAt: new Date().toISOString(),
  };
}
