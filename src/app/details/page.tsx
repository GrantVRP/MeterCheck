"use client";

// Technical details for younger users and judges.
// This is the only screen allowed to say "URL", "domain", "QR" and so on.

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { defang, defangUrl } from "@/lib/format";
import { useFlow, useHydrated } from "@/lib/store";
import styles from "./page.module.css";

const VERDICT_LABEL = { stop: "STOP", unsure: "NOT SURE", safe: "SAFE", "wrong-town": "WRONG TOWN?" } as const;
const PLACE_SOURCE = { gps: "GPS", picked: "picked by hand", none: "unknown" } as const;
const SAFE_BROWSING = {
  clean: "Not flagged",
  flagged: "Flagged as dangerous",
  skipped: "Not checked",
  error: "Could not check",
} as const;

export default function Details() {
  const hydrated = useHydrated();
  const { result } = useFlow();
  if (!hydrated) return null;

  if (!result) {
    return (
      <main className="page">
        <TopBar />
        <h1>No details yet</h1>
        <Link href="/" className="btn btn-primary">
          Start
        </Link>
      </main>
    );
  }

  const d = result.details;
  const where = d.place
    ? [
        d.place.label,
        result.zone ? `zone ${result.zone}${d.place.zoneDistanceM != null ? ` (${d.place.zoneDistanceM} m away)` : ""}` : "no zone within 150 m",
        `location ${PLACE_SOURCE[d.place.source]}${d.place.accuracyM ? `, ±${d.place.accuracyM} m` : ""}`,
      ].join("; ")
    : "Unknown";
  const rows: [string, React.ReactNode][] = [
    ["Verdict", VERDICT_LABEL[result.verdict]],
    // Shown "defanged" (hxxps, [.]) so the phone can never turn it into a link.
    ["Scanned URL", <span key="u" className={styles.mono}>{defangUrl(result.scanned.url)}</span>],
    ["Domain", <span key="h" className={styles.mono}>{result.scanned.host ? defang(result.scanned.host) : "Not a web address"}</span>],
    ["Place", where],
    [
      "City uses QR payment",
      d.cityUsesQr === null
        ? "Unknown city"
        : d.cityUsesQr
          ? "Yes"
          : d.freeParking
            ? "No: street parking is free"
            : "No: any QR code on a City machine is fake",
    ],
    ["Domain age", d.domainAgeDays === null ? "Unknown" : `${d.domainAgeDays} days`],
    [
      "Look-alike score",
      d.lookalike ? (
        <div key="l">
          {d.lookalike.score.toFixed(2)} (0 = not like any real one, 1 = very close fake)
          {d.lookalike.nearest ? <>, nearest real: <span className={styles.mono}>{defang(d.lookalike.nearest)}</span></> : null}
          {d.lookalike.signals?.length ? (
            <ul className={styles.signals}>
              {d.lookalike.signals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        "Not scored"
      ),
    ],
    [
      "Redirect chain",
      <div key="r">
        {d.redirects.length ? (
          <ol className={styles.chain}>
            {d.redirects.map((r, i) => (
              <li key={i} className={styles.mono}>
                {defangUrl(r)}
              </li>
            ))}
          </ol>
        ) : (
          "Not followed"
        )}
        {d.chainNote ? <p>{d.chainNote}</p> : d.redirects.length === 1 ? <p>No redirects.</p> : null}
      </div>,
    ],
    ["Google Safe Browsing", SAFE_BROWSING[d.safeBrowsing]],
    [
      "Sign photo",
      d.sticker
        ? `${d.sticker.sticker ? "Sticker found" : "No sticker"} (${Math.round(d.sticker.confidence * 100)}% sure): ${d.sticker.reason}`
        : "Not checked. Meter Check checks where the code goes, not the photo.",
    ],
  ];

  return (
    <main className="page">
      <TopBar href="/verdict" />
      <h1>Details</h1>

      <dl className={styles.list}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.row}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className={styles.reasons}>
        <h2>Why</h2>
        <ul>
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <p>
        Checked {new Date(result.checkedAt).toLocaleString("en-CA")}
        {result.fromCache ? " (saved demo result, no network used)" : ""}.
      </p>
      <p>Meter Check never opens the scanned address on your phone. Only our server looks it up.</p>
    </main>
  );
}
