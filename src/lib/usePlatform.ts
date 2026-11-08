"use client";

import { useSyncExternalStore } from "react";

export type Platform = "ios" | "android" | "other";

function detect(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so also check for touch.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** Which app store to link to. "other" until the page is running in the browser. */
export function usePlatform(): Platform {
  return useSyncExternalStore(
    () => () => {},
    detect,
    () => "other",
  );
}
