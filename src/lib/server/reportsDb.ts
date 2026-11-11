// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import "server-only";

// The reports database (Cloudflare D1, binding REPORTS_DB in wrangler.jsonc).
// Only the server writes to it. The table is in migrations/0001_reports.sql.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Report } from "@/lib/types";

/** The few D1 calls we use, typed here so we don't need the full Workers types. */
interface Statement {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface Db {
  prepare(query: string): Statement;
}

interface Row extends Omit<Report, "verdict_reasons" | "is_demo" | "photo_path"> {
  verdict_reasons: string;
  is_demo: number;
}

/** The database, or null when it isn't there (e.g. plain `next dev`). */
export async function reportsDb(): Promise<Db | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { REPORTS_DB?: Db }).REPORTS_DB as Db | undefined) ?? null;
  } catch {
    return null;
  }
}

function fromRow(r: Row): Report {
  let reasons: string[] = [];
  try {
    const parsed: unknown = JSON.parse(r.verdict_reasons);
    if (Array.isArray(parsed)) reasons = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    /* keep it empty */
  }
  return { ...r, verdict_reasons: reasons, photo_path: null, is_demo: r.is_demo === 1 };
}

const DAY_MS = 86_400_000;
/** The map shows the last 30 days. */
const KEEP_DAYS = 30;
const MAX_ROWS = 500;

export async function listReports(db: Db, now = Date.now()): Promise<Report[]> {
  const since = new Date(now - KEEP_DAYS * DAY_MS).toISOString();
  const { results } = await db
    .prepare("SELECT * FROM reports WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?")
    .bind(since, MAX_ROWS)
    .all<Row>();
  return results.map(fromRow);
}

/** Every report ever made, newest first. For the owner area only. */
export async function listAllReports(db: Db): Promise<Report[]> {
  const { results } = await db.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 5000").all<Row>();
  return results.map(fromRow);
}

/** The same fake code reported from the same spot in the last 2 minutes (e.g. a double tap). */
export async function findRecentSame(db: Db, r: Report, now = Date.now()): Promise<Report | null> {
  const since = new Date(now - 2 * 60_000).toISOString();
  const row = await db
    .prepare("SELECT * FROM reports WHERE fake_url = ? AND lat IS ? AND lon IS ? AND created_at >= ? LIMIT 1")
    .bind(r.fake_url, r.lat, r.lon, since)
    .first<Row>();
  return row ? fromRow(row) : null;
}

/** How many reports came in over the last minute, from anyone. Stops floods. */
export async function countLastMinute(db: Db, now = Date.now()): Promise<number> {
  const since = new Date(now - 60_000).toISOString();
  const row = await db.prepare("SELECT COUNT(*) AS n FROM reports WHERE created_at >= ?").bind(since).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function insertReport(db: Db, r: Report): Promise<void> {
  await db
    .prepare(
      "INSERT INTO reports (id, created_at, city_id, zone, lat, lon, fake_url, fake_host, verdict_reasons, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(r.id, r.created_at, r.city_id, r.zone, r.lat, r.lon, r.fake_url, r.fake_host, JSON.stringify(r.verdict_reasons), r.is_demo ? 1 : 0)
    .run();
}
