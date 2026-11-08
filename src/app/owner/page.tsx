"use client";

// The owner's map of every report, for passing on to the right authorities.
// Signed in with the owner password (a Cloudflare secret). Not linked from the app.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportsMap } from "@/components/ReportsMap";
import { TopBar } from "@/components/TopBar";
import { getCity } from "@/lib/registry";
import { clusterReports } from "@/lib/reports";
import type { Report } from "@/lib/types";
import styles from "../map/page.module.css";

type State = "loading" | "sign-in" | "not-set-up" | "error" | "ready";
const REFRESH_MS = 30_000;

export default function Owner() {
  const [state, setState] = useState<State>("loading");
  const [reports, setReports] = useState<Report[]>([]);
  const [city, setCity] = useState("all");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/reports", { cache: "no-store" });
      if (res.status === 401) return setState("sign-in");
      if (res.status === 503) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return setState(body.error === "not_set_up" ? "not-set-up" : "error");
      }
      if (!res.ok) return setState("error");
      setReports(((await res.json()) as { reports: Report[] }).reports);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Load once, then keep the map fresh while it's on screen.
    const first = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/owner/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    setPassword("");
    if (res?.ok) return load();
    setMessage(
      res?.status === 401
        ? "That password is wrong."
        : res?.status === 429
          ? "Too many wrong tries. Wait 15 minutes."
          : "Couldn't sign in right now. Try again.",
    );
  }

  async function signOut() {
    await fetch("/api/owner/logout", { method: "POST" }).catch(() => null);
    setReports([]);
    setState("sign-in");
  }

  const cities = useMemo(
    () =>
      [...new Set(reports.map((r) => r.city_id).filter((id): id is string => Boolean(id)))]
        .map((id) => ({ id, name: getCity(id)?.name ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [reports],
  );
  const shown = useMemo(() => reports.filter((r) => city === "all" || r.city_id === city), [reports, city]);
  const clusters = useMemo(() => clusterReports(shown), [shown]);
  const noPin = shown.filter((r) => r.lat == null || r.lon == null).length;

  return (
    <main className="page">
      <TopBar />
      <h1>Owner: all reports</h1>

      {state === "loading" && <p>Loading…</p>}

      {state === "not-set-up" && (
        <p className="panel panel-yellow">
          The owner area isn&apos;t set up yet. Set a password (8 or more characters) with{" "}
          <code>npx wrangler secret put OWNER_PASSWORD</code>.
        </p>
      )}

      {state === "error" && <p className="panel panel-yellow">Couldn&apos;t load the reports right now. Try again in a minute.</p>}

      {state === "sign-in" && (
        <form onSubmit={signIn} className="btn-stack">
          <label className={styles.filter}>
            <span className="label">Owner password</span>
            <input
              className={styles.select}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {message && (
            <p className="panel panel-yellow" role="alert">
              {message}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !password}>
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      )}

      {state === "ready" && (
        <>
          <p>
            {shown.length} {shown.length === 1 ? "report" : "reports"}
            {noPin ? ` (${noPin} with no location, so not on the map)` : ""}. Tap a pin for the full details.
          </p>
          <label className={styles.filter}>
            <span className="label">Show</span>
            <select className={styles.select} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <ReportsMap clusters={clusters} viewKey={city} label="Map of every report" detail />
          <button type="button" className="btn btn-outline" onClick={signOut}>
            Sign out
          </button>
        </>
      )}
    </main>
  );
}
