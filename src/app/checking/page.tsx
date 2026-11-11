// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/components/Icons";
import { buildResult, NOT_LOOKED_UP } from "@/lib/checks/result";
import { getFix } from "@/lib/location";
import { demoLinkFacts } from "@/lib/samples";
import { flowStore, useFlow, useHydrated } from "@/lib/store";
import type { CheckRequest, CheckResult, PendingCheck } from "@/lib/types";
import styles from "./page.module.css";

// A short, calm pause while the code is checked. Never a spinner, never "error".
const MIN_SHOW_MS = 1600;
/** If GPS has no reading yet, wait this long for one. */
const GPS_WAIT_MS = 4000;
/** Give up on the server after this long and check on the phone instead. */
const SERVER_TIMEOUT_MS = 15_000;

// Only the checks we really run. (The sign photo check isn't built, so it isn't listed.)
const STEPS = ["Where you are", "Where the code goes"];

const wait = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function withLocation(p: PendingCheck): Promise<CheckRequest> {
  const req: CheckRequest = { url: p.url, photo: p.photo };
  if (p.lat != null && p.lon != null) return { ...req, lat: p.lat, lon: p.lon, accuracy: p.accuracy };
  if (p.source === "gps") {
    const fix = await getFix(GPS_WAIT_MS);
    if (fix) {
      flowStore.set({ fix });
      return { ...req, lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy };
    }
  }
  return req;
}

function looksLikeResult(x: unknown): x is CheckResult {
  const r = x as CheckResult | null;
  return Boolean(r && ["stop", "unsure", "safe", "wrong-town"].includes(r.verdict) && typeof r.sentence === "string" && r.scanned);
}

async function askServer(req: CheckRequest, signal: AbortSignal): Promise<CheckResult> {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`check failed: ${res.status}`);
  const data: unknown = await res.json();
  if (!looksLikeResult(data)) throw new Error("bad result");
  return data;
}

export default function Checking() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { pending } = useFlow();

  useEffect(() => {
    if (!hydrated) return;
    if (!pending) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), SERVER_TIMEOUT_MS);
    const started = Date.now();

    (async () => {
      const req = await withLocation(pending);
      let result: CheckResult;
      try {
        result = await askServer(req, ctrl.signal);
      } catch {
        if (cancelled) return;
        // No server (offline, or it's slow): run the same checks here.
        // Demo codes use their saved look-ups; anything else can't be SAFE.
        const saved = demoLinkFacts(req.url);
        result = buildResult(req, saved ?? NOT_LOOKED_UP, { offline: !saved, fromCache: Boolean(saved) });
      }
      await wait(MIN_SHOW_MS - (Date.now() - started));
      if (cancelled) return;
      // Keep `pending` set: clearing it here would re-run this effect and send us Home.
      flowStore.set({ result, spot: req.lat != null && req.lon != null ? { lat: req.lat, lon: req.lon } : null });
      router.replace("/verdict");
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, [hydrated, pending, router]);

  return (
    <main className={`page ${styles.checking}`}>
      <div className="spacer" />
      <h1 className={styles.title} aria-live="polite">
        Checking where this code goes…
      </h1>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} />
      </div>
      <ul className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s} className={styles.step} style={{ animationDelay: `${300 + i * 400}ms` }}>
            <span className={styles.tick}>
              <CheckIcon />
            </span>
            {s}
          </li>
        ))}
      </ul>
      <div className="spacer" />
    </main>
  );
}
