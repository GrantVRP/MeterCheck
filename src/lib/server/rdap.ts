// How old is a website? Asks RDAP (the public registration records) via rdap.org.
// Scam sites are usually only days old. Gives up after 3 seconds.

import "server-only";

const DAY_MS = 86_400_000;
const CACHE_MS = 6 * 60 * 60_000;
const cache = new Map<string, { at: number; days: number | null }>();

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

export async function domainAgeDays(domain: string, timeoutMs = 3000): Promise<number | null> {
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.days;

  let days: number | null = null;
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      // rdap.org turns away requests with no proper name (403), so we say who we are.
      headers: { accept: "application/rdap+json, application/json", "user-agent": "MeterCheck/1.0 (parking code safety check)" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { events?: RdapEvent[] };
      const registered = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
      const t = registered ? Date.parse(registered) : Number.NaN;
      if (Number.isFinite(t)) days = Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
    }
  } catch {
    return null; // slow or offline: don't remember the failure
  }
  cache.set(domain, { at: Date.now(), days });
  return days;
}
