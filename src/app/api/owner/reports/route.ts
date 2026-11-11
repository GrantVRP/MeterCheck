// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

// GET /api/owner/reports: every report ever made, with full details. Owner only.

import { isOwner, ownerPassword } from "@/lib/server/owner";
import { listAllReports, reportsDb } from "@/lib/server/reportsDb";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!(await ownerPassword())) return Response.json({ error: "not_set_up" }, { status: 503, headers: NO_STORE });
  if (!(await isOwner(request))) return Response.json({ error: "sign_in" }, { status: 401, headers: NO_STORE });
  const db = await reportsDb();
  if (!db) return Response.json({ error: "no_database" }, { status: 503, headers: NO_STORE });
  try {
    return Response.json({ reports: await listAllReports(db) }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "database_error" }, { status: 503, headers: NO_STORE });
  }
}
