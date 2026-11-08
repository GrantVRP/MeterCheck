// Google Safe Browsing: is this address on Google's list of dangerous websites?
// Skipped when GOOGLE_SAFE_BROWSING_KEY is empty. Gives up after 3 seconds.

import "server-only";

export type SafeBrowsing = "clean" | "flagged" | "skipped" | "error";

export async function safeBrowsingStatus(urls: string[], timeoutMs = 3000): Promise<SafeBrowsing> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY?.trim();
  if (!key) return "skipped";
  if (!urls.length) return "skipped";
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "meter-check", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: urls.map((url) => ({ url })),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return "error";
    const data = (await res.json()) as { matches?: unknown[] };
    return data.matches?.length ? "flagged" : "clean";
  } catch {
    return "error";
  }
}
