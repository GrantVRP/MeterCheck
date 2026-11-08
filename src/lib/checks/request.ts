// Checks what the phone sent before we use any of it.

import { isValidLatLon } from "@/lib/geo";
import type { CheckRequest } from "@/lib/types";

export const MAX_URL_LENGTH = 2048;
/** About 1.5 MB of JPEG once decoded. The phone sends about 150 KB. */
export const MAX_PHOTO_LENGTH = 2_000_000;
export const MAX_BODY_LENGTH = MAX_PHOTO_LENGTH + 10_000;

export function parseCheckRequest(body: unknown): CheckRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  if (typeof b.url !== "string") return null;
  const url = b.url.trim();
  if (!url || url.length > MAX_URL_LENGTH) return null;

  const req: CheckRequest = { url };

  if (isValidLatLon(b.lat, b.lon)) {
    req.lat = b.lat as number;
    req.lon = b.lon as number;
    if (typeof b.accuracy === "number" && Number.isFinite(b.accuracy) && b.accuracy >= 0) {
      req.accuracy = b.accuracy;
    }
  }

  if (
    typeof b.photo === "string" &&
    b.photo.length <= MAX_PHOTO_LENGTH &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.photo)
  ) {
    req.photo = b.photo;
  }

  return req;
}
