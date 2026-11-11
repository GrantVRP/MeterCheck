// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Shared helpers for reports: loading them, the offline seed, clusters, labels, CSV export.

import { defang, timeAgo } from "./format";
import { distanceM } from "./geo";
import { findZone, getCity } from "./registry";
import type { CheckRequest, Report } from "./types";

interface SeedReport extends Omit<Report, "created_at"> {
  minutes_ago: number;
}

/** Loads the made-up demo reports. Times are relative, so the demo always looks "live". */
export async function loadSeedReports(now = Date.now()): Promise<Report[]> {
  const res = await fetch("/demo/seed-reports.json");
  const data = (await res.json()) as { reports: SeedReport[] };
  return data.reports.map(({ minutes_ago, ...r }) => ({
    ...r,
    created_at: new Date(now - minutes_ago * 60_000).toISOString(),
  }));
}

/** "City Centre Dr. pay machine (sample)", or the city name if we don't know the zone. */
export function reportPlace(r: Pick<Report, "zone" | "city_id">): string {
  return findZone(r.zone)?.zone.label ?? getCity(r.city_id)?.name ?? "Unknown place";
}

function csvCell(value: unknown): string {
  const s = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  // Quote everything; double any quotes. Leading = + - @ could run as a formula in Excel, so escape them.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of fake sites for cities, banks and the Canadian Anti-Fraud Centre. */
export function reportsToCsv(reports: Report[]): string {
  const cols: (keyof Report)[] = ["created_at", "city_id", "zone", "lat", "lon", "fake_host", "fake_url", "verdict_reasons", "is_demo"];
  const lines = [cols.join(",")];
  for (const r of reports) lines.push(cols.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Every report on the map, from our server. Throws if it can't be reached. */
export async function fetchReports(signal?: AbortSignal): Promise<Report[]> {
  const res = await fetch("/api/reports", { cache: "no-store", signal });
  if (!res.ok) throw new Error(`reports: ${res.status}`);
  const data = (await res.json()) as { reports?: unknown };
  if (!Array.isArray(data.reports)) throw new Error("reports: bad answer");
  return data.reports.filter(
    (r): r is Report =>
      Boolean(r) && typeof r.id === "string" && typeof r.created_at === "string" && typeof r.fake_host === "string" && typeof r.fake_url === "string",
  );
}

/** Sends a report. The server checks the code again and saves it. null if it couldn't be sent. */
export async function sendReport(req: Pick<CheckRequest, "url" | "lat" | "lon" | "accuracy">): Promise<Report | null> {
  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { report?: Report };
    return data.report ?? null;
  } catch {
    return null;
  }
}

export interface Cluster {
  lat: number;
  lon: number;
  /** Newest first. */
  reports: Report[];
  /** e.g. "6 reports · same fake site · last 2 hours" */
  label: string;
}

/** Reports this close in place and time are drawn as one pin. */
const CLUSTER_M = 300;
const CLUSTER_MS = 2 * 3_600_000;

export function clusterLabel(reports: Report[], now = Date.now()): string {
  const newest = reports[0];
  if (reports.length === 1) return `${defang(newest.fake_host)} · ${timeAgo(newest.created_at, now)}`;
  const hosts = new Set(reports.map((r) => r.fake_host)).size;
  const site = hosts === 1 ? "same fake site" : `${hosts} fake sites`;
  const oldest = reports[reports.length - 1];
  const when = now - Date.parse(oldest.created_at) <= CLUSTER_MS ? "last 2 hours" : timeAgo(newest.created_at, now);
  return `${reports.length} reports · ${site} · ${when}`;
}

/**
 * Groups reports made within 300 m and 2 hours of each other into one pin.
 * Reports with no location are left off the map (they still show in the list).
 */
export function clusterReports(reports: Report[], now = Date.now()): Cluster[] {
  const pinned = reports
    .filter((r): r is Report & { lat: number; lon: number } => r.lat != null && r.lon != null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups: { lat: number; lon: number; reports: (Report & { lat: number; lon: number })[] }[] = [];
  for (const r of pinned) {
    const t = Date.parse(r.created_at);
    const g = groups.find((x) => distanceM(x, r) <= CLUSTER_M && Date.parse(x.reports[0].created_at) - t <= CLUSTER_MS);
    if (g) g.reports.push(r);
    else groups.push({ lat: r.lat, lon: r.lon, reports: [r] });
  }
  return groups.map((g) => ({
    lat: g.reports.reduce((s, r) => s + r.lat, 0) / g.reports.length,
    lon: g.reports.reduce((s, r) => s + r.lon, 0) / g.reports.length,
    reports: g.reports,
    label: clusterLabel(g.reports, now),
  }));
}
