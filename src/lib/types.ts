// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import type { PlaceId } from "./places";

/** wrong-town: a real company's code, but for another town (or our idea of where you are is wrong). */
export type Verdict = "stop" | "unsure" | "safe" | "wrong-town";

export interface StickerResult {
  sticker: boolean;
  confidence: number; // 0-1
  reason: string;
}

/** What the server sends back for one scanned code. */
export interface CheckResult {
  verdict: Verdict;
  /** The big words, e.g. "Fake link. Don't pay." (older saved results may not have it). */
  headline?: string;
  /** Where "Go to the real site" goes for this place, from our own list. Never the scanned address. */
  realSite?: { url: string; label: string } | null;
  /** One calm sentence, grade-6 reading level. */
  sentence: string;
  /** Plain-English reasons (used in Details and in reports). */
  reasons: string[];
  placeId: PlaceId | null;
  cityId: string | null;
  zone: string | null;
  scanned: { url: string; host: string };
  /** Only set when the verdict is SAFE: the verified address to continue to. */
  safeUrl: string | null;
  details: {
    cityUsesQr: boolean | null;
    /** The town doesn't charge for street parking. */
    freeParking?: boolean;
    domainAgeDays: number | null;
    /** Every address the code led to, starting with the scanned one. */
    redirects: string[];
    /** Why we stopped following redirects early, if we did. */
    chainNote?: string | null;
    lookalike: { score: number; nearest: string | null; signals?: string[] } | null;
    safeBrowsing: "clean" | "flagged" | "skipped" | "error";
    sticker: StickerResult | null;
    /** Where we think the person is. */
    place?: {
      label: string;
      source: "gps" | "picked" | "none";
      zoneDistanceM: number | null;
      accuracyM: number | null;
    };
  };
  /** True when the result came from the offline demo cache. */
  fromCache?: boolean;
  checkedAt: string;
}

/** What the phone sends to POST /api/check. */
export interface CheckRequest {
  /** The text read from the code. Never opened on the phone. */
  url: string;
  lat?: number;
  lon?: number;
  /** GPS accuracy in metres. 0 means a place picked by hand. */
  accuracy?: number;
  /** JPEG data URL of the camera frame, for the sticker check. */
  photo?: string;
}

/** A code that was read by the camera and is waiting to be checked. */
export interface PendingCheck extends CheckRequest {
  /** Where the location came from: the phone's GPS, or the place picked on the Change screen. */
  source: "gps" | "picked";
}

/** A GPS reading, kept for this tab only. */
export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  /** When it was taken (ms since 1970). */
  at: number;
}

/** A fake-code report, as stored in the reports database (and in the offline seed file). */
export interface Report {
  id: string;
  created_at: string;
  /** null when the report was made somewhere we don't check. */
  city_id: string | null;
  zone: string | null;
  /** Rounded to 4 decimal places (about 10 m). null if the phone didn't know where it was. */
  lat: number | null;
  lon: number | null;
  fake_url: string;
  fake_host: string;
  verdict_reasons: string[];
  photo_path: string | null;
  is_demo: boolean;
}
