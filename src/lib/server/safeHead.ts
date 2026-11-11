// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// Looking up where a scanned address goes, safely.
// - HEAD requests only: we never download, render or run the page.
// - No cookies, no body, a few seconds at most.
// - Never connects to private or local network addresses.
//
// This file has no Node-only code, so it runs on the laptop and on Cloudflare.
// The request itself is done by a HeadFn: nodeHead.ts on the laptop, fetchHead.ts on Cloudflare.

import "server-only";
import { isBlockedAddress, isIpAddress } from "./ipRanges";

export { isBlockedAddress };

/** Why we won't even try this address, or null if it's fine to look up. */
export function refusal(url: URL): string | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Refused: only http and https addresses are looked up.";
  if (url.username || url.password) return "Refused: the address has a hidden user name or password in it.";
  if (url.port && url.port !== "443" && url.port !== "80") return "Refused: the address uses an unusual port.";
  const bare = url.hostname.replace(/^\[|\]$/g, "");
  if (isIpAddress(bare) && isBlockedAddress(bare)) return "Refused: it points to a private or local network address.";
  if (bare === "localhost" || bare.endsWith(".localhost")) return "Refused: it points to a private or local network address.";
  return null;
}

export interface HeadResult {
  status: number;
  location: string | null;
}

export type HeadFn = (url: URL, timeoutMs: number) => Promise<HeadResult>;

export const USER_AGENT = "MeterCheck/1.0 (parking code safety check)";

/** A plain-English note for Details about why we stopped. */
function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const name = (e as { name?: string })?.name ?? "";
  if (code === "EREFUSED_ADDRESS") return "Refused: it points to a private or local network address.";
  if (code === "ETIMEDOUT" || name === "TimeoutError" || name === "AbortError") return "The website took too long to answer.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "That website name does not exist.";
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) return "The website's security certificate is not valid.";
  if (code === "ECONNREFUSED" || code === "ECONNRESET") return "The website refused to connect.";
  return "We could not reach the website.";
}

export interface Followed {
  /** Every address visited, starting with the scanned one. */
  chain: string[];
  /** true only if we reached an address that doesn't redirect any more. */
  complete: boolean;
  note: string | null;
}

/**
 * Follows redirects with HEAD requests: at most `maxHops` hops, `perHopMs` each,
 * and `totalMs` for the whole chain. Every hop is checked before we connect.
 */
export async function followRedirects(
  start: string,
  { head, maxHops = 3, perHopMs = 3000, totalMs = 6000 }: { head: HeadFn; maxHops?: number; perHopMs?: number; totalMs?: number },
): Promise<Followed> {
  let current: URL;
  try {
    current = new URL(start);
  } catch {
    return { chain: [], complete: false, note: "Not a web address." };
  }
  const chain = [current.href];
  const deadline = Date.now() + totalMs;

  for (let hops = 0; ; hops++) {
    const refused = refusal(current);
    if (refused) return { chain, complete: false, note: refused };

    const left = deadline - Date.now();
    if (left <= 0) return { chain, complete: false, note: "The website took too long to answer." };

    let res: HeadResult;
    try {
      res = await head(current, Math.min(perHopMs, left));
    } catch (e) {
      return { chain, complete: false, note: describeError(e) };
    }

    const isRedirect = res.status >= 300 && res.status < 400 && res.location;
    if (!isRedirect) return { chain, complete: true, note: null };

    if (hops >= maxHops) return { chain, complete: false, note: `Stopped after ${maxHops} redirects.` };
    try {
      current = new URL(res.location!, current);
    } catch {
      return { chain, complete: false, note: "It sent a broken redirect." };
    }
    chain.push(current.href);
  }
}
