// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Check 2: Link. Server only. Follows redirects, asks how old the website is,
// and asks Google Safe Browsing. Never opens the page itself.

import "server-only";
import { isIpHost, parseWebUrl, registrableDomain } from "@/lib/checks/address";
import type { LinkFacts } from "@/lib/checks/verdict";
import { domainAgeDays } from "./rdap";
import { safeBrowsingStatus } from "./safeBrowsing";
import { followRedirects, type HeadFn } from "./safeHead";

/**
 * On Cloudflare we use its fetch (it refuses private networks for us). On the laptop
 * we use Node, which checks every address itself. Loaded only when needed, so
 * Cloudflare never runs the Node-only code.
 */
async function pickHead(): Promise<HeadFn> {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return (await import("./fetchHead")).fetchHead;
  }
  return (await import("./nodeHead")).nodeHead;
}

function domainOf(url: string | undefined): string | null {
  const host = url ? parseWebUrl(url)?.hostname : undefined;
  return host && !isIpHost(host) ? registrableDomain(host) : null;
}

export async function checkLink(url: string): Promise<LinkFacts> {
  const parsed = parseWebUrl(url);
  if (!parsed) {
    return {
      chain: [],
      chainComplete: false,
      chainNote: "Not an http or https address, so it was not looked up.",
      domainAgeDays: null,
      safeBrowsing: "skipped",
    };
  }

  // The website's age and the redirects are looked up at the same time.
  const firstDomain = domainOf(parsed.href);
  const firstAge = firstDomain ? domainAgeDays(firstDomain) : Promise.resolve(null);
  const followed = await followRedirects(parsed.href, { head: await pickHead() });

  // If it sends you to a different website, how old is that one?
  const lastDomain = domainOf(followed.chain.at(-1));
  const [ageA, ageB, safeBrowsing] = await Promise.all([
    firstAge,
    lastDomain && lastDomain !== firstDomain ? domainAgeDays(lastDomain) : Promise.resolve(null),
    safeBrowsingStatus(followed.chain),
  ]);
  const ages = [ageA, ageB].filter((a): a is number => a !== null);

  return {
    chain: followed.chain,
    chainComplete: followed.complete,
    chainNote: followed.note,
    domainAgeDays: ages.length ? Math.min(...ages) : null,
    safeBrowsing,
  };
}
