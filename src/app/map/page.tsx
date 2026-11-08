"use client";

import { useEffect, useMemo, useState } from "react";
import { DownloadIcon } from "@/components/Icons";
import { ReportsMap } from "@/components/ReportsMap";
import { TopBar } from "@/components/TopBar";
import { defang, timeAgo } from "@/lib/format";
import { getCity } from "@/lib/registry";
import { clusterReports, downloadCsv, fetchReports, loadSeedReports, reportPlace, reportsToCsv } from "@/lib/reports";
import { useFlow, useHydrated, useSettings } from "@/lib/store";
import type { Report } from "@/lib/types";
import styles from "./page.module.css";

/** How often the map asks for new reports, so one from another phone shows up. */
const REFRESH_MS = 10_000;

export default function ReportMap() {
  const hydrated = useHydrated();
  const { lastReport } = useFlow();
  const { demoMode } = useSettings();
  const [seed, setSeed] = useState<Report[]>([]);
  const [live, setLive] = useState<Report[] | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [city, setCity] = useState<string>("all");

  useEffect(() => {
    loadSeedReports()
      .then(setSeed)
      .catch(() => setSeed([]));
  }, []);

  useEffect(() => {
    let stopped = false;
    const ctrl = new AbortController();
    const load = () =>
      fetchReports(ctrl.signal)
        .then((r) => {
          if (stopped) return;
          setLive(r);
          setReachable(true);
        })
        .catch(() => {
          if (!stopped) setReachable(false);
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      stopped = true;
      ctrl.abort();
      clearInterval(timer);
    };
  }, []);

  // Live reports, plus the made-up demo ones (in demo mode, or when the live map can't be reached),
  // plus your own latest report even if it couldn't be sent.
  const offline = reachable === false && !live;
  const all = useMemo(() => {
    const byId = new Map<string, Report>();
    for (const r of [...(lastReport ? [lastReport] : []), ...(live ?? []), ...(demoMode || offline ? seed : [])]) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
    return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [lastReport, live, seed, demoMode, offline]);

  const cities = useMemo(
    () =>
      [...new Set(all.map((r) => r.city_id).filter((id): id is string => Boolean(id)))]
        .map((id) => ({ id, name: getCity(id)?.name ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [all],
  );
  const shown = useMemo(() => all.filter((r) => city === "all" || r.city_id === city), [all, city]);
  const clusters = useMemo(() => clusterReports(shown), [shown]);
  const focus =
    lastReport && lastReport.lat != null && lastReport.lon != null && shown.some((r) => r.id === lastReport.id)
      ? { lat: lastReport.lat, lon: lastReport.lon }
      : null;

  return (
    <main className="page">
      <TopBar />
      <h1>Fake code reports</h1>

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

      {hydrated && <ReportsMap clusters={clusters} focus={focus} viewKey={city} label="Map of fake code reports" />}

      <p className="panel panel-yellow" role="status">
        {offline
          ? "Showing saved demo reports. The live map can't be reached right now."
          : reachable
            ? `Live: new reports show up within ${REFRESH_MS / 1000} seconds.${demoMode ? " Reports marked demo are made up." : ""}`
            : "Loading reports…"}
      </p>

      {shown.length === 0 ? (
        <p>No reports yet.</p>
      ) : (
        <ol className={styles.list} aria-label="Reports, newest first">
          {shown.map((r) => (
            <li key={r.id} className={styles.item}>
              <strong className={styles.host}>{defang(r.fake_host)}</strong>
              <span>{reportPlace(r)}</span>
              <span>
                {timeAgo(r.created_at)}
                {r.is_demo ? " · demo" : ""}
                {r.id === lastReport?.id ? " · your report" : ""}
              </span>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        className="btn btn-outline"
        disabled={shown.length === 0}
        onClick={() => downloadCsv(`meter-check-fake-sites-${new Date().toISOString().slice(0, 10)}.csv`, reportsToCsv(shown))}
      >
        <DownloadIcon />
        Export fake sites (CSV)
      </button>
    </main>
  );
}
