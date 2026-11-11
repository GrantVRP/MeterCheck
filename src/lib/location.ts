// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Where the person is: GPS, or the place they picked on the Change screen.
// Browser only. Readings stay on this phone except when sent with a check.

import { getPlace, type PlaceId } from "./places";
import type { Fix } from "./types";

/** A GPS reading older than this is not used for a check. */
const FRESH_MS = 2 * 60_000;

export function canUseGps(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function toFix(p: GeolocationPosition): Fix {
  return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp || Date.now() };
}

export function isFresh(fix: Fix | null | undefined): fix is Fix {
  return Boolean(fix && Date.now() - fix.at < FRESH_MS);
}

/** One GPS reading, or null if it's off, refused or too slow. Never throws. maxAgeMs 0 forces a new reading. */
export function getFix(timeoutMs: number, maxAgeMs = 60_000): Promise<Fix | null> {
  if (!canUseGps()) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toFix(p)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: maxAgeMs },
    );
  });
}

/** Keeps reading GPS until the returned function is called. onOff: location refused or unavailable. */
export function watchFix(onFix: (fix: Fix) => void, onOff?: () => void): () => void {
  if (!canUseGps()) {
    onOff?.();
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix(toFix(p)),
    // Refused or unavailable: the check will say it doesn't know where you are.
    (err) => {
      if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) onOff?.();
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** The picked place's spot, sent instead of GPS. Accuracy 0 means "picked by hand". */
export function pickedLocation(placeId: PlaceId) {
  const { zone } = getPlace(placeId);
  return { lat: zone.lat, lon: zone.lon, accuracy: 0 };
}
