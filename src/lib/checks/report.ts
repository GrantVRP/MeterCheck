// Turns a "Report it" tap into a report for the map. The server runs this, so a
// report is only saved if our own rules say the code is fake (STOP) at that spot.
// Whatever the phone claims about the verdict is ignored.

import type { CheckRequest, Report } from "@/lib/types";
import { buildResult } from "./result";
import type { LinkFacts } from "./verdict";

/** About 10 m: close enough for the map, not an exact spot. */
export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function buildReport(
  req: CheckRequest,
  link: LinkFacts,
  opts: { demo: boolean; id: string; now?: number },
): Report | null {
  const result = buildResult({ url: req.url, lat: req.lat, lon: req.lon, accuracy: req.accuracy }, link);
  if (result.verdict !== "stop" || !result.scanned.host) return null;
  const hasSpot = req.lat != null && req.lon != null;
  return {
    id: opts.id,
    created_at: new Date(opts.now ?? Date.now()).toISOString(),
    city_id: result.cityId,
    zone: result.zone,
    lat: hasSpot ? round4(req.lat!) : null,
    lon: hasSpot ? round4(req.lon!) : null,
    fake_url: req.url,
    fake_host: result.scanned.host,
    verdict_reasons: result.reasons,
    photo_path: null,
    is_demo: opts.demo,
  };
}
