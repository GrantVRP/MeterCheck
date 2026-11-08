"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowOutIcon, CardIcon, FlagIcon, PhoneIcon, PinIcon, SpeakerIcon } from "@/components/Icons";
import { SymbolCircle } from "@/components/SymbolCircle";
import { round4 } from "@/lib/checks/report";
import { canUseGps, getFix } from "@/lib/location";
import { getPlace } from "@/lib/places";
import { sendReport } from "@/lib/reports";
import { prefersReducedMotion, speak, stopSpeaking } from "@/lib/speech";
import { flowStore, useFlow, useHydrated, useSettings } from "@/lib/store";
import type { CheckResult, Report, Verdict } from "@/lib/types";
import { useTown } from "@/lib/useTown";
import { WORDS } from "@/lib/words";
import styles from "./page.module.css";

const SCREEN_COLOUR: Record<Verdict, string> = {
  stop: "#a3161a",
  unsure: "#ffd100",
  safe: "#0b5d2a",
  "wrong-town": "#4d4d4d",
};

/** Paints the browser bar and overscroll area in the verdict colour while this screen is open. */
function useScreenColour(verdict: Verdict | null) {
  useEffect(() => {
    if (!verdict) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = meta?.content;
    if (meta) meta.content = SCREEN_COLOUR[verdict];
    document.body.style.background = SCREEN_COLOUR[verdict];
    return () => {
      if (meta && before) meta.content = before;
      document.body.style.background = "";
    };
  }, [verdict]);
}

/** The verdict words appear letter by letter over about a second (all at once with reduced motion). */
const TYPE_MS = 1000;

function useTyped(text: string): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0));
  useEffect(() => {
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), TYPE_MS / text.length);
    return () => clearTimeout(t);
  }, [shown, text]);
  return shown;
}

export default function VerdictPage() {
  const hydrated = useHydrated();
  const { result } = useFlow();
  useScreenColour(hydrated && result ? result.verdict : null);
  useEffect(() => stopSpeaking, []);

  if (!hydrated) return null;
  if (!result) {
    return (
      <main className="page">
        <h1>Nothing checked yet</h1>
        <Link href="/" className="btn btn-primary">
          Start
        </Link>
      </main>
    );
  }
  return <VerdictScreen result={result} />;
}

function VerdictScreen({ result }: { result: CheckResult }) {
  const router = useRouter();
  const settings = useSettings();
  const town = useTown();
  const place = getPlace(result.placeId ?? settings.placeId);
  const { verdict } = result;
  const words = result.headline ?? WORDS[verdict];
  const typed = useTyped(words);
  const spoken = `${words} ${result.sentence}`;

  // Read the verdict out loud as it types, unless the voice is off in Settings.
  useEffect(() => {
    if (!settings.voice) return;
    speak(spoken);
    return () => stopSpeaking();
  }, [settings.voice, spoken]);
  // From our own list for this place, never the scanned address. Older saved results fall back to the picked place.
  const realSite = result.realSite !== undefined ? result.realSite : place.realSite;
  const onColor = verdict !== "unsure";

  function readAgain() {
    speak(spoken);
  }

  // Grey "Wrong town?": read the location again and check the same code there.
  // With a place picked by hand (or no GPS), let them choose where they are instead.
  const [finding, setFinding] = useState(false);
  async function checkAgain() {
    const pending = flowStore.get().pending;
    if (pending && settings.useGps && canUseGps()) {
      setFinding(true);
      const fix = await getFix(10_000, 0);
      setFinding(false);
      if (fix) {
        flowStore.set({ fix, pending: { url: pending.url, source: "gps", lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy } });
        router.replace("/checking");
        return;
      }
    }
    router.push(pending ? "/place?recheck=1" : "/place");
  }

  // One tap: everything is already filled in (place, time, fake address).
  // The server checks the code again before it goes on the map for everyone.
  function report() {
    const flow = flowStore.get();
    if (flow.lastReport && flow.reportFor === result.checkedAt && flow.reportStatus !== "failed") {
      router.push("/report/sent"); // already reported this check
      return;
    }
    const spot = town.spot;
    const r: Report = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
      created_at: new Date().toISOString(),
      city_id: result.cityId,
      zone: result.zone,
      lat: spot ? round4(spot.lat) : null,
      lon: spot ? round4(spot.lon) : null,
      fake_url: result.scanned.url,
      fake_host: result.scanned.host,
      verdict_reasons: result.reasons,
      photo_path: null,
      is_demo: settings.demoMode,
    };
    flowStore.set({ lastReport: r, reportStatus: "sending", reportFor: result.checkedAt });
    router.push("/report/sent");
    sendReport({ url: result.scanned.url, ...(spot ? { lat: spot.lat, lon: spot.lon } : {}) }).then((saved) => {
      if (flowStore.get().lastReport?.id !== r.id) return; // a newer report took its place
      flowStore.set(saved ? { lastReport: saved, reportStatus: "sent" } : { reportStatus: "failed" });
    });
  }

  return (
    <main className={`${styles.verdict} ${styles[verdict]} ${onColor ? "on-color" : ""}`}>
      <header className={styles.header}>
        <SymbolCircle verdict={verdict} />
        <button type="button" className="pill" onClick={readAgain}>
          <SpeakerIcon />
          Read it again
        </button>
      </header>

      <div className={styles.body}>
        <h1 className={styles.words}>
          <span className="sr-only">{words}</span>
          {/* The untyped part takes its space already, so nothing below jumps. */}
          <span aria-hidden="true">
            {words.slice(0, typed)}
            <span className={styles.untyped}>{words.slice(typed)}</span>
          </span>
        </h1>
        <p className={styles.sentence}>{result.sentence}</p>

        {verdict === "safe" && result.safeUrl && (
          <div className={styles.address}>
            <span className={styles.addressLabel}>The real address is</span>
            <span className={styles.addressHost}>
              {/* Allow line breaks only after a dot: "hotspotparking." / "com" */}
              {new URL(result.safeUrl).hostname
                .replace(/^www\./, "")
                .split(".")
                .map((part, i, all) => (
                  <span key={i}>
                    {part}
                    {i < all.length - 1 && (
                      <>
                        .<wbr />
                      </>
                    )}
                  </span>
                ))}
            </span>
          </div>
        )}

        <div className="btn-stack">
          {verdict === "stop" && (
            <>
              {realSite && (
                <a href={realSite.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <ArrowOutIcon />
                  Go to the real site
                </a>
              )}
              <Link href="/help" className="btn btn-outline">
                <PhoneIcon />
                Call for help
              </Link>
              <Link href="/pay" className="btn btn-outline">
                <CardIcon />
                Pay without scanning
              </Link>
              <div className={styles.reportGroup}>
                <p>Warn other people:</p>
                <button type="button" className="btn btn-white" onClick={report}>
                  <FlagIcon />
                  Report it
                </button>
              </div>
            </>
          )}

          {verdict === "unsure" && (
            <>
              <Link href="/pay" className="btn btn-primary">
                <CardIcon />
                Pay without scanning
              </Link>
              <Link href="/help" className="btn btn-outline">
                <PhoneIcon />
                Call for help
              </Link>
            </>
          )}

          {verdict === "wrong-town" && (
            <>
              <button type="button" className="btn btn-primary" onClick={checkAgain} disabled={finding}>
                <PinIcon />
                {finding ? "Finding you…" : "Check my location again"}
              </button>
              <Link href="/pay" className="btn btn-outline">
                <CardIcon />
                Pay without scanning
              </Link>
              <Link href="/help" className="btn btn-outline">
                <PhoneIcon />
                Call for help
              </Link>
            </>
          )}

          {verdict === "safe" && result.safeUrl && (
            <a href={result.safeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <ArrowOutIcon />
              Continue to pay
            </a>
          )}
        </div>

        <div className={styles.links}>
          <Link href="/details" className="text-link">
            Details
          </Link>
          <Link href="/scan" className="text-link">
            Check another code
          </Link>
        </div>
      </div>
    </main>
  );
}
