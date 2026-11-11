// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// POST /api/check: the phone sends { url, lat, lon, accuracy, photo? } and gets one verdict back.
// The scanned address is only ever looked up here, on the server, and never opened.

import { buildResult } from "@/lib/checks/result";
import { MAX_BODY_LENGTH, parseCheckRequest } from "@/lib/checks/request";
import { demoLinkFacts } from "@/lib/samples";
import { checkLink } from "@/lib/server/link";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) {
    return Response.json({ error: "too_big" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const req = parseCheckRequest(body);
  if (!req) return Response.json({ error: "bad_request" }, { status: 400 });

  // Demo codes use saved look-ups, so the demo never depends on the network.
  const saved = demoLinkFacts(req.url);
  const link = saved ?? (await checkLink(req.url));

  const result = buildResult(req, link, { fromCache: Boolean(saved) });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
