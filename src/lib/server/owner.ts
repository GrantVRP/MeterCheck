// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

import "server-only";

// The owner area (/owner): one password, set as a Cloudflare secret (OWNER_PASSWORD).
// The password is never in the code. A signed cookie keeps you signed in for 12 hours,
// and changing the password signs everyone out.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Db } from "./reportsDb";

export const OWNER_COOKIE = "mc_owner";
const SESSION_MS = 12 * 3_600_000;
/** Wrong passwords allowed from one network in 15 minutes. */
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60_000;
const MIN_LENGTH = 8;

/** The owner password, or null if it isn't set (or is too short to be safe). */
export async function ownerPassword(): Promise<string | null> {
  let pw: unknown;
  try {
    const { env } = await getCloudflareContext({ async: true });
    pw = (env as unknown as Record<string, unknown>).OWNER_PASSWORD;
  } catch {
    /* not on Cloudflare (e.g. next dev): use .env.local */
  }
  pw = pw ?? process.env.OWNER_PASSWORD;
  return typeof pw === "string" && pw.length >= MIN_LENGTH ? pw : null;
}

const enc = new TextEncoder();

async function hmac(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in the same time whatever they hold, so timing gives nothing away. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function passwordMatches(given: string, real: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac("meter-check-owner", given), hmac("meter-check-owner", real)]);
  return sameText(a, b);
}

/** "expiry.signature", signed with the password. */
export async function newSession(real: string, now = Date.now()): Promise<string> {
  const exp = now + SESSION_MS;
  return `${exp}.${await hmac(real, `owner:${exp}`)}`;
}

export async function sessionValid(value: string | null, real: string, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [expText, sig = ""] = value.split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp < now || exp > now + SESSION_MS) return false;
  return sameText(sig, await hmac(real, `owner:${exp}`));
}

export function readCookie(request: Request, name = OWNER_COOKIE): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function sessionCookie(value: string, request: Request, maxAgeMs = SESSION_MS): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${OWNER_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}

/** True if the request carries a valid owner sign-in. */
export async function isOwner(request: Request): Promise<boolean> {
  const real = await ownerPassword();
  return Boolean(real) && (await sessionValid(readCookie(request), real!));
}

async function networkHash(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`meter-check:${ip}`)));
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Too many wrong passwords from this network lately? */
export async function tooManyFails(db: Db, request: Request, now = Date.now()): Promise<boolean> {
  const since = new Date(now - FAIL_WINDOW_MS).toISOString();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM owner_logins WHERE ip_hash = ? AND at >= ?")
    .bind(await networkHash(request), since)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= MAX_FAILS;
}

export async function recordFail(db: Db, request: Request, now = Date.now()): Promise<void> {
  await db.prepare("INSERT INTO owner_logins (ip_hash, at) VALUES (?, ?)").bind(await networkHash(request), new Date(now).toISOString()).run();
  // Forget failures older than a day.
  await db.prepare("DELETE FROM owner_logins WHERE at < ?").bind(new Date(now - 86_400_000).toISOString()).run();
}
