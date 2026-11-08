// The verdict rules, in one place. Pure: same facts in, same verdict out.
//
// STOP if any check clearly fails. SAFE only if every check passes.
// WRONG TOWN (grey) when the code is a real company's, but for another town.
// NOT SURE for everything else. Never guess SAFE.

import { SAFE_REDIRECT_HOSTS } from "@/lib/providers";
import { coverageSentence, getCity, townsUsing, townUsesCompany } from "@/lib/registry";
import type { StickerResult, Verdict } from "@/lib/types";
import { parseWebUrl, registrableDomain } from "./address";
import { cityOfSite, ownerOf, ownersOf, scoreLookalike, type Lookalike } from "./lookalike";
import { nearestTown, type PlaceCheck } from "./place";

/** A look-alike score at or above this is treated as a fake. */
export const LOOKALIKE_STOP = 0.6;
/** A website younger than this that borrows a company's name is a fake. */
export const NEW_SITE_DAYS = 30;
/** A sticker the photo check is at least this sure about means STOP. */
export const STICKER_STOP = 0.7;

/** What the server found out about the address (or what the demo cache says). */
export interface LinkFacts {
  /** Every address visited, starting with the scanned one. Empty if not followed. */
  chain: string[];
  /** true only if we followed every redirect to the end. */
  chainComplete: boolean;
  /** Why we stopped following, for Details. */
  chainNote: string | null;
  /** Age of the youngest website in the chain, if known. */
  domainAgeDays: number | null;
  safeBrowsing: "clean" | "flagged" | "skipped" | "error";
}

export interface VerdictFacts {
  place: Pick<PlaceCheck, "status" | "cityId" | "cityName" | "usesQr" | "allowedHosts" | "expectedUrl"> & {
    companies?: string[];
    freeParking?: boolean;
    nearby?: PlaceCheck["nearby"];
    /** Where the person is, if we know (to name the nearest town a company is used in). */
    at?: PlaceCheck["at"];
  };
  /** The text read from the code. */
  url: string;
  link: LinkFacts;
  sticker: StickerResult | null;
}

/** Which sentence to use. Phase 4 may let an AI write it, with these as the fallback. */
export type ReasonKey =
  | "no-qr-city"
  | "free-parking"
  | "near-border"
  | "safe-browsing"
  | "lookalike"
  | "redirect-lookalike"
  | "sticker"
  | "safe"
  | "no-location"
  | "unknown-city"
  | "not-web"
  | "official-other"
  | "other-town"
  | "city-site"
  | "not-allowed"
  | "not-https"
  | "wrong-zone"
  | "chain-incomplete"
  | "redirect-elsewhere"
  | "maybe-sticker";

export interface Decision {
  verdict: Verdict;
  key: ReasonKey;
  /** The company it pretends to be, or really is. */
  brand: string | null;
  /** Plain-English reasons, strongest first. */
  reasons: string[];
  /** The worst look-alike score in the chain, for Details. */
  lookalike: Lookalike | null;
  /** SAFE only: the checked https address to continue to. */
  safeUrl: string | null;
  /** WRONG TOWN only: the nearest town where this code is real. */
  otherTown?: string | null;
}

/** Same address, ignoring http/https, a trailing slash and upper/lower case in the host. */
function sameAddress(a: string, b: string): boolean {
  const pa = parseWebUrl(a);
  const pb = parseWebUrl(b);
  if (!pa || !pb) return false;
  const norm = (u: URL) => `${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, "")}${u.search}`;
  return norm(pa) === norm(pb);
}

/**
 * Does this list of allowed addresses cover a host? Yes if the host is listed, its
 * registrable name is listed, or the company that owns it is behind a whole listed name
 * (hotspotparking.com, www.hotspotparking.com and htsp.ca are all HotSpot's).
 * An exact address on a shared service (sarnia.ezpayca.com, a town's ticket page) counts only
 * for itself: it never makes the rest of that company's websites real in the town.
 */
function allowsHost(hosts: string[]): (h: string) => boolean {
  const listed = new Set(hosts.map((h) => h.toLowerCase()));
  const owners = ownersOf([...listed].filter((h) => registrableDomain(h) === h));
  return (h) => listed.has(h) || listed.has(registrableDomain(h)) || owners.includes(ownerOf(h) ?? "");
}

export function decide(f: VerdictFacts): Decision {
  const city = f.place.cityName ?? "This city";
  // The companies that run the city's own parking, e.g. ["HotSpot"], named in reasons.
  // (Never the ticket pages or park services also allowed here: they don't run the town's parking.)
  const companies = f.place.companies ?? ownersOf(f.place.allowedHosts);
  const realName = companies.join(" or ") || "the real parking service";
  // Every company that may take payment here (the city's own and trusted private car parks).
  // Any website they own counts (hotspotparking.com, www.hotspotparking.com, htsp.ca...).
  const isAllowed = allowsHost(f.place.allowedHosts);
  const scanned = parseWebUrl(f.url);
  const host = scanned?.hostname.toLowerCase() ?? "";
  // Near a border: a town next door whose real parking company this is.
  const nextDoor = scanned && !isAllowed(host) ? (f.place.nearby ?? []).find((n) => allowsHost(n.allowedHosts)(host)) : undefined;
  const siteCity = host ? cityOfSite(host) : null;
  // A town's own website (any town we know): not a scam, but not a place to pay either.
  const isCitySite = siteCity !== null;
  // A real parking company whose codes are real in other towns we check, but not here.
  const owner = scanned ? ownerOf(host) : null;
  // The town's own app company with a code it never uses (e.g. PayByPhone in Ottawa) stays a fake, not a wrong town.
  const townsOwnApp = owner !== null && townUsesCompany(getCity(f.place.cityId), owner);
  const otherTowns =
    owner && !isAllowed(host) && !isCitySite && !townsOwnApp ? townsUsing(owner).filter((c) => c.id !== f.place.cityId) : [];
  // A code copied from a known sign names its own town (e.g. the downtown Peterborough sign).
  const signTown = otherTowns.find((c) => c.known_codes?.some((u) => sameAddress(u, f.url)));
  const otherTown = nextDoor?.cityName ?? signTown?.name ?? nearestTown(f.place.at ?? null, otherTowns)?.name ?? null;
  // Wrong town (grey): the code may be in the wrong place, or our idea of where you are may be wrong.
  const wrongTown = f.place.status === "found" && Boolean(nextDoor || otherTowns.length);

  // Every host the code touches: the scanned one first, then each redirect.
  const hops = [...new Set([host, ...f.link.chain.map((u) => parseWebUrl(u)?.hostname.toLowerCase() ?? "")])].filter(Boolean);
  // An app store is fine to end up on after a real company's link, never as the code itself.
  const isFineHop = (h: string) => isAllowed(h) || (h !== host && SAFE_REDIRECT_HOSTS.has(h));
  const scored = hops
    .filter((h) => !isFineHop(h))
    .map((h) => ({ host: h, viaRedirect: h !== host, look: scoreLookalike(h) }));
  const worst = scored.reduce<(typeof scored)[number] | null>((w, s) => (!w || s.look.score > w.look.score ? s : w), null);

  // ---------- STOP: any check clearly fails ----------
  const stops: { key: ReasonKey; reasons: string[] }[] = [];

  // The City says it never uses codes, so any code is fake, unless it goes to the
  // company of a private car park we know there (e.g. a hospital lot).
  // A town's own website is left to the NOT SURE "city-site" rule below.
  if (f.place.usesQr === false && !(scanned && isAllowed(host)) && !wrongTown && !isCitySite) {
    stops.push(
      f.place.freeParking
        ? {
            key: "free-parking",
            reasons: [
              `${city} does not charge for parking on its streets, so its signs have no payment codes.`,
              owner ? `This is ${owner}'s website, but we don't know of ${owner} parking in ${city}.` : "This is not a parking website we know.",
            ],
          }
        : {
            key: "no-qr-city",
            reasons: [
              `${city} does not use codes on its parking machines.`,
              ...(getCity(f.place.cityId)?.city_statement ? [`${city} says any code on its parking machines is fake.`] : []),
            ],
          },
    );
  }
  if (f.link.safeBrowsing === "flagged") {
    stops.push({ key: "safe-browsing", reasons: ["Google lists this website as dangerous."] });
  }
  if (worst && worst.look.score >= LOOKALIKE_STOP) {
    stops.push({
      key: worst.viaRedirect ? "redirect-lookalike" : "lookalike",
      reasons: [
        worst.viaRedirect ? "It sends you on to a different website." : "The address is not a real parking website.",
        ...worst.look.signals,
      ],
    });
  }
  const age = f.link.domainAgeDays;
  if (age !== null && age < NEW_SITE_DAYS && worst && (worst.look.brand || worst.look.score >= 0.3)) {
    stops.push({ key: "lookalike", reasons: [`The website is only ${age} ${age === 1 ? "day" : "days"} old.`] });
  }
  if (f.sticker?.sticker && f.sticker.confidence >= STICKER_STOP) {
    stops.push({ key: "sticker", reasons: ["A sticker was put over the sign."] });
  }
  // Look the address up in our list. Anything not on it is a sketchy link, never safe.
  if (scanned && !isCitySite && !wrongTown && !stops.some((s) => s.key === "no-qr-city" || s.key === "free-parking")) {
    if (f.place.status === "found" && !isAllowed(host)) {
      // In a city we check, a code must go to a company that takes payment there.
      stops.push(
        owner
          ? {
              key: "official-other",
              reasons: [
                companies.length
                  ? `This is ${owner}'s website, but ${city}'s parking signs use ${realName}.`
                  : `This is ${owner}'s website, but we don't know of ${owner} parking in ${city}.`,
              ],
            }
          : companies.length
            ? {
                key: "not-allowed",
                reasons: [`This is not ${realName}'s website.`, `${city}'s parking codes go to ${realName}.`, ...(worst?.look.signals ?? [])],
              }
            : {
                key: "not-allowed",
                reasons: [`We don't know of a parking app that ${city} uses.`, "This is not a parking website we know.", ...(worst?.look.signals ?? [])],
              },
      );
    } else if (f.place.status !== "found" && !owner) {
      // We don't know where you are, but no parking company we know uses this website.
      stops.push({
        key: "not-allowed",
        reasons: ["This is not a parking website we know.", ...(worst?.look.signals ?? [])],
      });
    }
  }

  if (stops.length) {
    return {
      verdict: "stop",
      key: stops[0].key,
      brand: worst?.look.brand ?? (stops[0].key === "official-other" ? owner : null),
      reasons: [...new Set(stops.flatMap((s) => s.reasons))],
      lookalike: worst?.look ?? null,
      safeUrl: null,
    };
  }

  // ---------- WRONG TOWN: a real company's code, for another town ----------
  if (wrongTown) {
    const brand = owner ?? "a parking company";
    return {
      verdict: "wrong-town",
      key: nextDoor ? "near-border" : "other-town",
      brand: owner,
      reasons: [
        `This is ${brand}'s real website${otherTown ? `, used in ${otherTown}` : ""}.`,
        nextDoor
          ? `You may be near the edge of ${city} and ${nextDoor.cityName}.`
          : f.place.usesQr === false
            ? f.place.freeParking
              ? `${city} does not charge for parking on its streets.`
              : `${city} does not use codes on its parking machines.`
            : companies.length
              ? `${city}'s parking signs use ${realName}.`
              : `We don't know of ${brand} parking in ${city}.`,
        "The code may be in the wrong town, or your location may be wrong.",
      ],
      lookalike: worst?.look ?? null,
      safeUrl: null,
      otherTown,
    };
  }

  // ---------- NOT SURE, unless every SAFE check passes ----------
  const unsure = (key: ReasonKey, reasons: string[], brand: string | null = null): Decision => ({
    verdict: "unsure",
    key,
    brand,
    reasons,
    lookalike: worst?.look ?? null,
    safeUrl: null,
  });

  if (!scanned) return unsure("not-web", ["This code is not a normal website address."]);
  if (isCitySite) {
    return unsure("city-site", [`This is the City of ${getCity(siteCity)?.name ?? city}'s own website, not a place to pay.`]);
  }
  if (f.place.status === "no-location") {
    return unsure("no-location", ["We could not tell where you are.", `This is ${ownerOf(host)}'s real website.`], ownerOf(host));
  }
  if (f.place.status === "unknown-city") {
    return unsure("unknown-city", [coverageSentence(), `This is ${ownerOf(host)}'s real website.`], ownerOf(host));
  }
  if (!isAllowed(host)) {
    // Not reached: every address that isn't allowed here was turned away above.
    return unsure("not-allowed", ["We don't know this website."]);
  }

  const brand = ownerOf(host);
  if (f.place.expectedUrl && !sameAddress(f.url, f.place.expectedUrl)) {
    return unsure("wrong-zone", [`It goes to ${brand ?? "the real website"}, but not to the zone on this sign.`], brand);
  }
  if (!f.link.chainComplete) {
    return unsure(
      "chain-incomplete",
      ["We could not follow where it goes all the way.", ...(f.link.chainNote ? [f.link.chainNote] : [])],
      brand,
    );
  }
  if (hops.some((h) => !isFineHop(h))) {
    return unsure("redirect-elsewhere", ["It sends you on to a website we don't know."], brand);
  }
  // Where you end up must be https. "http://hotspotparking.com" is fine if HotSpot itself
  // sends it on to https: we open that final https address, so nothing travels unprotected.
  // If the company's link ends in an app store, we open the company's own last address instead.
  const chain = f.link.chain.length ? f.link.chain : [f.url];
  const lastOwn = [...chain].reverse().find((u) => isAllowed(parseWebUrl(u)?.hostname.toLowerCase() ?? ""));
  const final = parseWebUrl(lastOwn ?? f.url);
  if (!final || final.protocol !== "https:") {
    return unsure("not-https", ["The address is not secure: it does not use https."], brand);
  }
  if (f.sticker?.sticker) {
    return unsure("maybe-sticker", ["There may be a sticker on the sign."], brand);
  }

  // ---------- SAFE: every check passed ----------
  return {
    verdict: "safe",
    key: "safe",
    brand,
    reasons: [
      `The address is ${brand ?? "the parking service"}'s real address.`,
      companies.includes(brand ?? "")
        ? `${brand} runs ${city}'s parking.`
        : `${brand ?? "This company"} is a parking service used in ${city}.`,
      "It does not send you to a website we don't know.",
      f.sticker ? "No sticker was found on the sign." : "The sign was not checked for a sticker.",
    ],
    lookalike: null,
    safeUrl: final.href,
  };
}
