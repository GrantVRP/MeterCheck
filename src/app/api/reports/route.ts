// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// GET /api/reports: fake-code reports for the map (last 30 days), newest first.
// POST /api/reports: { url, lat?, lon?, accuracy? } from the "Report it" button.
// Only our server writes reports. A report is saved only if our own rules say the code is fake there.

import { buildReport } from "@/lib/checks/report";
import { parseCheckRequest } from "@/lib/checks/request";
import { NOT_LOOKED_UP } from "@/lib/checks/result";
import { demoLinkFacts } from "@/lib/samples";
import { checkLink } from "@/lib/server/link";
import { countLastMinute, findRecentSame, insertReport, listReports, reportsDb } from "@/lib/server/reportsDb";

// Always read the database fresh.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** Reports from everyone, per minute, before we pause new ones. */
const MAX_PER_MINUTE = 30;

export async function GET() {
  const db = await reportsDb();
  if (!db) return Response.json({ error: "no_database" }, { status: 503, headers: NO_STORE });
  try {
    return Response.json({ reports: await listReports(db) }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "database_error" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 10_000) return Response.json({ error: "too_big" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const parsed = parseCheckRequest(body);
  if (!parsed) return Response.json({ error: "bad_request" }, { status: 400 });
  const req = { url: parsed.url, lat: parsed.lat, lon: parsed.lon, accuracy: parsed.accuracy };

  const db = await reportsDb();
  if (!db) return Response.json({ error: "no_database" }, { status: 503 });

  const id = crypto.randomUUID();
  // Check again here. Most fakes are clear without going online; only look the address up if we must.
  const saved = demoLinkFacts(req.url);
  let report = buildReport(req, saved ?? NOT_LOOKED_UP, { demo: Boolean(saved), id });
  if (!report && !saved) report = buildReport(req, await checkLink(req.url), { demo: false, id });
  if (!report) return Response.json({ error: "not_fake" }, { status: 422 });

  try {
    const same = await findRecentSame(db, report);
    if (same) return Response.json({ report: same }, { headers: NO_STORE });
    if ((await countLastMinute(db)) >= MAX_PER_MINUTE) return Response.json({ error: "busy" }, { status: 429 });
    await insertReport(db, report);
  } catch {
    return Response.json({ error: "database_error" }, { status: 503 });
  }
  return Response.json({ report }, { status: 201, headers: NO_STORE });
}
