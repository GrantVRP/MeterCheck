// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// How much does an address look like a real parking company's address?
// 0 = nothing like it (or it IS the company), 1 = a very close fake.
// Pure, so it can be tested and explained step by step.

import { PROVIDERS, providerOfHost } from "@/lib/providers";
import { registry } from "@/lib/registry";
import { isIpHost, registrableDomain, splitHost } from "./address";

interface Brand {
  name: string;
  /** The word a fake would borrow, e.g. "paybyphone". */
  word: string;
  /** Websites the company really owns. */
  domains: string[];
}

function hostOfSite(site: string | undefined): string[] {
  if (!site) return [];
  try {
    return [new URL(site).hostname];
  } catch {
    return [];
  }
}

/**
 * Companies a fake might pretend to be: every provider with a distinctive name
 * (src/data/providers.json). Common names like "Indigo" are left out of the
 * look-alike scoring so ordinary websites aren't called fakes, but they still
 * count as real companies in ownerOf().
 */
const BRANDS: Brand[] = PROVIDERS.filter((p) => p.word).map((p) => ({ name: p.name, word: p.word!, domains: p.domains }));

/** "hotspotparking.com" -> "HotSpot", or null if no company we know owns it. */
export function ownerOf(host: string): string | null {
  return providerOfHost(host)?.name ?? null;
}

/** The companies behind a list of hosts, e.g. ["hotspotparking.com"] -> ["HotSpot"]. */
export function ownersOf(hosts: string[]): string[] {
  return [...new Set(hosts.map(ownerOf).filter((o): o is string => o !== null))];
}

/** The registry city whose own website this is (e.g. peterborough.ca), or null. */
export function cityOfSite(host: string): string | null {
  const domain = registrableDomain(host);
  if (providerOfHost(host)) return null; // a parking company's address is never a city's own site
  return (
    registry.cities.find((c) =>
      [...hostOfSite(c.official_page), ...(c.city_domains ?? [])].map((d) => registrableDomain(d.toLowerCase())).includes(domain),
    )?.id ?? null
  );
}

// Link shorteners hide where a code really goes.
const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at",
  "tiny.cc", "rb.gy", "t.ly", "bl.ink", "s.id", "qrco.de", "short.io", "lnkd.in", "v.gd", "tiny.one",
]);

// Endings that cost almost nothing and are popular with scammers. Real parking services here use .com or .ca.
const ODD_ENDINGS = new Set([
  "online", "site", "top", "xyz", "info", "click", "live", "shop", "store", "icu", "buzz", "cfd", "sbs", "rest",
  "lol", "cyou", "monster", "vip", "work", "link", "fun", "space", "website", "pw", "tk", "ml", "ga", "cf", "gq",
  "bond", "today", "support", "help", "best", "quest", "mom", "autos", "cam", "zip", "mov",
]);

// Words scammers add to look official: "-parking", "-pay", "secure-".
const EXTRA_WORDS = /(^|-)(parking|park|pay|payment|payments|secure|login|verify|account|portal|ticket|tickets|fine|fines|meter|meters|official|online|app)(-|$)/;

// Letters and numbers swapped in to fool the eye: 0 for o, 1 for l, rn for m.
function plain(label: string): string {
  return label
    .replace(/-/g, "")
    .replace(/0/g, "o")
    .replace(/[1|]/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

/** Number of single-letter changes to turn a into b (Levenshtein distance). */
export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

/** Does the name use the company's word? Short words must stand alone ("greenp-pay", not "greenpeace"). */
function usesBrandWord(label: string, word: string): boolean {
  if (label.split(/[-\d]+/).includes(word)) return true;
  return word.length >= 7 && label.includes(word);
}

export interface Lookalike {
  /** 0 to 1. */
  score: number;
  /** The real address it's closest to. */
  nearest: string | null;
  /** The company it pretends to be (or really is, when score is 0). */
  brand: string | null;
  /** Plain-English reasons. */
  signals: string[];
}

export function scoreLookalike(host: string): Lookalike {
  const h = host.toLowerCase().replace(/\.$/, "");

  if (isIpHost(h)) {
    return { score: 0.7, nearest: null, brand: null, signals: ["The address is a string of numbers, not a website name."] };
  }

  const parts = splitHost(h);
  const owner = BRANDS.find((b) => b.domains.includes(parts.domain));
  if (owner) return { score: 0, nearest: parts.domain, brand: owner.name, signals: [] };
  if (cityOfSite(h)) return { score: 0, nearest: parts.domain, brand: null, signals: [] };

  let strong = 0;
  let extra = 0;
  let nearest: string | null = null;
  let brand: string | null = null;
  const signals: string[] = [];
  const raise = (score: number, signal: string, b?: Brand, target?: string) => {
    if (score > strong) {
      strong = score;
      if (b) brand = b.name;
      if (target) nearest = target;
    }
    if (!signals.includes(signal)) signals.push(signal);
  };

  if (h.split(".").some((l) => l.startsWith("xn--"))) {
    raise(0.7, "The address uses letters from other alphabets that look like ours.");
  }

  if (SHORTENERS.has(parts.domain)) {
    raise(0.5, "It uses a short link that hides where it really goes.");
  }

  for (const b of BRANDS) {
    const target = b.domains[0];
    // A real company's name in front of a different website: "hotspotparking.com.pay-now.xyz".
    if (parts.sub && (b.domains.some((d) => parts.sub.includes(d)) || usesBrandWord(parts.sub.replace(/\./g, "-"), b.word))) {
      raise(0.9, `It puts "${b.word}" at the front to fool you. The real website is ${target}.`, b, target);
    }
    if (usesBrandWord(parts.label, b.word)) {
      raise(0.6, `It uses the name ${b.name}, but it is not ${b.name}'s real website.`, b, target);
    }
    for (const d of b.domains) {
      const real = splitHost(d);
      if (parts.label === real.label) {
        raise(0.85, `It has the same name as ${d}, but a different ending.`, b, d);
        continue;
      }
      const a = plain(parts.label);
      const r = plain(real.label);
      if (r.length < 6) continue; // too short to compare fairly
      const dist = editDistance(a, r);
      if (dist === 0) {
        raise(0.9, `It is made to look like ${d}.`, b, d);
      } else if (dist <= 2) {
        raise(Math.max(0.65, 1 - dist / Math.max(a.length, r.length)), `It is made to look like ${d}.`, b, d);
      } else if (r.length >= 7 && a.includes(r)) {
        // The real name with words added: "hotspotparkingpay". (Not for short names: "greenpeace".)
        raise(0.8, `It is made to look like ${d}.`, b, d);
      }
    }
  }

  if (EXTRA_WORDS.test(parts.label)) {
    extra += 0.15;
    signals.push('It adds words like "parking" or "pay" to look official.');
  }

  const lastEnding = parts.ending.split(".").pop() ?? "";
  if (ODD_ENDINGS.has(lastEnding)) {
    extra += 0.2;
    signals.push(`It ends in .${lastEnding}, which real parking services here don't use.`);
  }

  // For the Details screen: the closest real address, if it's at all close (at most 40% different).
  if (!nearest) {
    let best = Infinity;
    for (const b of BRANDS) {
      for (const d of b.domains) {
        const real = plain(splitHost(d).label);
        const dist = editDistance(plain(parts.label), real);
        if (dist < best && dist <= real.length * 0.4) {
          best = dist;
          nearest = d;
        }
      }
    }
  }

  const score = Math.round(Math.min(1, strong + extra) * 100) / 100;
  return { score, nearest, brand, signals };
}
