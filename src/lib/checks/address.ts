// Reading web addresses. Pure: used by the server and by the phone when offline.

// A website name with no "https://" in front, e.g. "hotspotparking.com/z/1001".
// Many QR code makers leave it off, and phones still open it as a website.
const BARE_SITE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

/** The parsed address if it's an http or https link (or a bare website name), otherwise null. */
export function parseWebUrl(text: string): URL | null {
  const t = text.trim();
  try {
    const url = new URL(BARE_SITE.test(t) ? `https://${t}` : t);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function hostOf(text: string): string {
  return parseWebUrl(text)?.hostname.toLowerCase().replace(/\.$/, "") ?? "";
}

/** Bare number addresses like 203.0.113.9 or [2001:db8::1]. */
export function isIpHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || (host.startsWith("[") && host.endsWith("]"));
}

// Endings where people register names one level down (e.g. example.co.uk, example.on.ca).
// A short list instead of the full Public Suffix List: enough for this app.
const TWO_LEVEL_ENDINGS = new Set([
  "on.ca", "qc.ca", "bc.ca", "ab.ca", "mb.ca", "sk.ca", "ns.ca", "nb.ca", "nl.ca", "pe.ca", "nt.ca", "nu.ca", "yk.ca", "gc.ca",
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk",
  "com.au", "net.au", "org.au", "co.nz", "co.za", "co.in", "co.jp", "co.kr",
  "com.br", "com.mx", "com.cn", "com.hk", "com.sg", "com.tw", "com.tr",
]);

export interface HostParts {
  /** What's in front of the name, e.g. "www" or "hotspotparking.com.pay". */
  sub: string;
  /** The name someone registered, without its ending, e.g. "hotspotparking". */
  label: string;
  /** The ending, e.g. "com" or "on.ca". */
  ending: string;
  /** label + ending, e.g. "hotspotparking.com". */
  domain: string;
}

export function splitHost(host: string): HostParts {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (isIpHost(h)) return { sub: "", label: h, ending: "", domain: h };
  const parts = h.split(".");
  if (parts.length < 2) return { sub: "", label: h, ending: "", domain: h };
  const lastTwo = parts.slice(-2).join(".");
  const endingSize = parts.length >= 3 && TWO_LEVEL_ENDINGS.has(lastTwo) ? 2 : 1;
  const ending = parts.slice(-endingSize).join(".");
  const label = parts[parts.length - endingSize - 1];
  const sub = parts.slice(0, parts.length - endingSize - 1).join(".");
  return { sub, label, ending, domain: `${label}.${ending}` };
}

/** The part someone registered, e.g. "pay.hotspotparking.com" -> "hotspotparking.com". */
export function registrableDomain(host: string): string {
  return splitHost(host).domain;
}
