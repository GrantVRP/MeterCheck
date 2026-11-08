"use client";

import Link from "next/link";
import { CheckIcon, MapIcon, PinIcon } from "@/components/Icons";
import { ReportsMap } from "@/components/ReportsMap";
import { defang, timeAgo } from "@/lib/format";
import { clusterReports, reportPlace } from "@/lib/reports";
import { useFlow, useHydrated } from "@/lib/store";
import styles from "./page.module.css";

export default function ReportSent() {
  const hydrated = useHydrated();
  const { lastReport, reportStatus } = useFlow();
  const pinned = lastReport && lastReport.lat != null && lastReport.lon != null ? lastReport : null;

  const headline = !hydrated
    ? "Your report"
    : reportStatus === "sending"
      ? "Sending your report…"
      : reportStatus === "failed"
        ? "Saved on this phone."
        : pinned
          ? "Thanks. Your report is on the map."
          : "Thanks. Your report is saved.";

  return (
    <main className="page">
      <span className={styles.badge} aria-hidden="true">
        <CheckIcon />
      </span>
      <h1 aria-live="polite">{headline}</h1>
      {hydrated && reportStatus === "failed" && (
        <p className="panel panel-yellow">We couldn&apos;t reach the map for everyone right now. It shows on this phone&apos;s map.</p>
      )}
      {hydrated && lastReport && !pinned && <p>We didn&apos;t know where you were, so it has no pin on the map.</p>}

      {hydrated && pinned && (
        <ReportsMap clusters={clusterReports([pinned])} focus={{ lat: pinned.lat!, lon: pinned.lon! }} mini label="Your report on the map" />
      )}

      <div className={styles.mini} aria-label="Your new report">
        <PinIcon className={styles.pin} />
        {hydrated && lastReport ? (
          <div className={styles.miniText}>
            <strong>{reportPlace(lastReport)}</strong>
            <span>{timeAgo(lastReport.created_at)}</span>
            <span className={styles.host}>{defang(lastReport.fake_host)}</span>
          </div>
        ) : (
          <div className={styles.miniText}>
            <strong>Your report</strong>
          </div>
        )}
      </div>

      <div className="btn-stack">
        <Link href="/map" className="btn btn-primary">
          <MapIcon />
          See the map
        </Link>
        <Link href="/" className="btn btn-outline">
          Done
        </Link>
      </div>
    </main>
  );
}
