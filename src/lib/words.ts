import type { Verdict } from "./types";

/** The big verdict words. Short and direct, like a road sign. */
export const WORDS: Record<Verdict, string> = {
  stop: "Sketchy link. Don't pay.",
  unsure: "Not sure. Pay another way.",
  safe: "Safe to pay.",
  "wrong-town": "Wrong town? Don't pay yet.",
};

/** Used when the AI sentence is slow or unavailable. */
export const FALLBACK_SENTENCE: Record<Verdict, string> = {
  stop: "This code does not go to the real parking service.",
  unsure: "We can't be sure this code is real, so it is safer to pay another way.",
  safe: "This code goes to the real parking service for this city.",
  "wrong-town": "This code is for another town, or your location may be wrong.",
};

/** STOP for a fake made to fool you (look-alike, Google warning, sticker), not just an address we don't know. */
export const FAKE_HEADLINE = "Fake link. Don't pay.";

const FAKE_KEYS = new Set(["lookalike", "redirect-lookalike", "safe-browsing", "sticker", "no-qr-city"]);

/** The big words for a verdict: "Sketchy link" for an address not on our list, "Fake link" for a clear fake. */
export function headlineFor(verdict: Verdict, key: string): string {
  return verdict === "stop" && FAKE_KEYS.has(key) ? FAKE_HEADLINE : WORDS[verdict];
}
