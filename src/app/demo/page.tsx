// Printable codes for our demo props. Open on the laptop and print, or scan right off the screen.
// Drawn on the server at build time, so no code-drawing script reaches the phone.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { TopBar } from "@/components/TopBar";
import { buildResult } from "@/lib/checks/result";
import { defang } from "@/lib/format";
import { getPlace } from "@/lib/places";
import { DEMO_CODES } from "@/lib/samples";
import { PrintButton } from "./PrintButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Demo codes · Meter Check",
  robots: { index: false, follow: false },
};

const WHAT_IT_IS: Record<string, string> = {
  "peterborough-real": "HotSpot's real address, from the downtown Peterborough sign",
  "peterborough-lookalike": "made-up look-alike of HotSpot",
  "mississauga-sticker": "made-up look-alike of PayByPhone",
  "unknown-site": "made-up site that isn't HotSpot",
  "city-site": "the City of Peterborough's own page (not a place to pay)",
  "wrong-town": "HotSpot's real address, but checked in Mississauga",
};

export default async function DemoCodes() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") notFound();

  const codes = await Promise.all(
    DEMO_CODES.map(async (c, i) => ({
      ...c,
      // The same code as an earlier one (e.g. the Peterborough code checked in Mississauga): no second copy.
      sameAs: DEMO_CODES.findIndex((d) => d.url === c.url) + 1 < i + 1 ? DEMO_CODES.findIndex((d) => d.url === c.url) + 1 : null,
      host: new URL(c.url).hostname,
      // What the app says for this code at its place, worked out with the real rules.
      headline: (() => {
        const z = getPlace(c.placeId).zone;
        return buildResult({ url: c.url, lat: z.lat, lon: z.lon, accuracy: 0 }, c.link, { fromCache: true }).headline;
      })(),
      svg: await QRCode.toString(c.url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        color: { dark: "#111111", light: "#ffffff" },
      }),
    })),
  );

  return (
    <main className={`page ${styles.demo}`}>
      <div className={styles.noPrint}>
        <TopBar />
      </div>
      <h1>Demo codes</h1>
      <p className="panel panel-yellow">
        These are made-up demo addresses for our props. Print them, or scan them right off the laptop screen. Don&apos;t
        open them.
      </p>
      <PrintButton className={`btn btn-primary ${styles.noPrint}`} />

      <ol className={styles.list}>
        {codes.map((c, i) => (
          <li key={c.id} className={styles.code}>
            <h2 className={styles.label}>
              {i + 1}. {c.label}
            </h2>
            {c.sameAs ? (
              <p className="panel panel-yellow">Same code as number {c.sameAs}. Pick the place below, then scan code {c.sameAs}.</p>
            ) : (
              <div className={styles.qr} role="img" aria-label={`Demo code: ${c.label}`} dangerouslySetInnerHTML={{ __html: c.svg }} />
            )}
            <dl className={styles.facts}>
              <div>
                <dt>Pick place</dt>
                <dd>{getPlace(c.placeId).label}</dd>
              </div>
              <div>
                <dt>Should say</dt>
                <dd>{c.headline}</dd>
              </div>
              <div>
                <dt>Goes to</dt>
                <dd>
                  <span className={styles.mono}>{defang(c.host)}</span> ({WHAT_IT_IS[c.id] ?? "made up"})
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </main>
  );
}
