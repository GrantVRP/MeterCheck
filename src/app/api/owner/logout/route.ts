// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// POST /api/owner/logout: signs the owner out on this device.

import { sessionCookie } from "@/lib/server/owner";

export async function POST(request: Request) {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie("", request, 0) } });
}
