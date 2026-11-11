// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

import { describe, expect, it } from "vitest";
import { clusterLabel, clusterReports } from "@/lib/reports";
import type { Report } from "@/lib/types";
import { buildReport } from "./report";
import { NOT_LOOKED_UP } from "./result";

const PTBO = { lat: 44.304812345, lon: -78.319912345 };

describe("buildReport (the server's check before a report goes on the map)", () => {
  it("saves a fake, with the spot rounded to about 10 m", () => {
    const r = buildReport({ url: "https://parkeasy-ptbo.com/pay/1001", ...PTBO }, NOT_LOOKED_UP, { demo: false, id: "a", now: 0 });
    expect(r).not.toBeNull();
    expect(r!.city_id).toBe("peterborough-on");
    expect(r!.lat).toBe(44.3048);
    expect(r!.lon).toBe(-78.3199);
    expect(r!.fake_host).toBe("parkeasy-ptbo.com");
    expect(r!.created_at).toBe("1970-01-01T00:00:00.000Z");
  });

  it("refuses to put the real company on the map as a fake", () => {
    expect(buildReport({ url: "https://hotspotparking.com/tapPoster/park/htspTap50", ...PTBO }, NOT_LOOKED_UP, { demo: false, id: "b" })).toBeNull();
  });

  it("refuses things that aren't web addresses", () => {
    expect(buildReport({ url: "hello there", ...PTBO }, NOT_LOOKED_UP, { demo: false, id: "c" })).toBeNull();
  });

  it("keeps a report with no location, without a pin", () => {
    const r = buildReport({ url: "https://hotspot-parking-pay.online/zone/1001" }, NOT_LOOKED_UP, { demo: true, id: "d" });
    expect(r?.lat).toBeNull();
    expect(r?.is_demo).toBe(true);
  });
});

const NOW = Date.parse("2026-11-08T15:00:00Z");
const rep = (id: string, minsAgo: number, lat: number | null, lon: number | null, host = "fake-pay.online"): Report => ({
  id,
  created_at: new Date(NOW - minsAgo * 60_000).toISOString(),
  city_id: "mississauga-on",
  zone: null,
  lat,
  lon,
  fake_url: `https://${host}/`,
  fake_host: host,
  verdict_reasons: [],
  photo_path: null,
  is_demo: false,
});

describe("clusterReports", () => {
  it("groups reports within 300 m and 2 hours into one pin", () => {
    const rs = [0, 10, 25, 40, 70, 100].map((m, i) => rep(`r${i}`, m, 43.589 + i * 0.0002, -79.6441));
    const clusters = clusterReports(rs, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].label).toBe("6 reports · same fake site · last 2 hours");
  });

  it("keeps far-apart or hours-apart reports separate", () => {
    const clusters = clusterReports(
      [rep("a", 5, 43.589, -79.6441), rep("b", 5, 43.6, -79.6441), rep("c", 300, 43.589, -79.6441)],
      NOW,
    );
    expect(clusters).toHaveLength(3);
  });

  it("names how many fake sites a group has", () => {
    const rs = [rep("a", 5, 43.589, -79.6441, "one.online"), rep("b", 6, 43.589, -79.6441, "two.online")];
    expect(clusterLabel(rs, NOW)).toBe("2 reports · 2 fake sites · last 2 hours");
    expect(clusterLabel([rs[0]], NOW)).toBe("one[.]online · 5 min ago");
  });

  it("leaves reports with no location off the map", () => {
    expect(clusterReports([rep("a", 5, null, null)], NOW)).toEqual([]);
  });
});
