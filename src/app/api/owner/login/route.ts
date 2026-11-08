// POST /api/owner/login { password }: signs the owner in with a cookie for 12 hours.

import { newSession, ownerPassword, passwordMatches, recordFail, sessionCookie, tooManyFails } from "@/lib/server/owner";
import { reportsDb } from "@/lib/server/reportsDb";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const real = await ownerPassword();
  if (!real) return Response.json({ error: "not_set_up" }, { status: 503, headers: NO_STORE });
  const db = await reportsDb();
  if (!db) return Response.json({ error: "no_database" }, { status: 503, headers: NO_STORE });

  if (await tooManyFails(db, request)) return Response.json({ error: "too_many" }, { status: 429, headers: NO_STORE });

  const text = await request.text();
  let password = "";
  try {
    const body = JSON.parse(text.slice(0, 1000)) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    /* treated as a wrong password */
  }

  if (!(await passwordMatches(password, real))) {
    await recordFail(db, request);
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return Response.json({ error: "wrong" }, { status: 401, headers: NO_STORE });
  }
  return Response.json({ ok: true }, { headers: { ...NO_STORE, "Set-Cookie": sessionCookie(await newSession(real), request) } });
}
