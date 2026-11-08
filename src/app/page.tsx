"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CardIcon, GearIcon, PhoneIcon, PinIcon, ScanIcon, SpeakerIcon } from "@/components/Icons";
import { checkPlace } from "@/lib/checks/place";
import { telFromInput } from "@/lib/contacts";
import { watchFix } from "@/lib/location";
import { getPlace } from "@/lib/places";
import { coverageSentence } from "@/lib/registry";
import { primeSpeech, speak } from "@/lib/speech";
import { flowStore, useFlow, useHydrated, useSettings } from "@/lib/store";
import type { Fix } from "@/lib/types";
import styles from "./page.module.css";

/** The picked place, or with GPS on, wherever the last reading puts us. */
function describeWhere(useGps: boolean, pickedLabel: string, fix: Fix | null, gpsOff: boolean) {
  if (!useGps) return { label: pickedLabel, sentence: `You are in ${pickedLabel}.` };
  if (!fix && gpsOff) return { label: "Location off", sentence: "Your location is off. Tap Change to pick your place." };
  if (!fix) return { label: "Finding you…", sentence: "Finding where you are." };
  const p = checkPlace(fix);
  if (p.status === "found") return { label: p.label, sentence: `You are in ${p.label}.` };
  return {
    label: p.label,
    sentence: `${p.areaName ? `You are in ${p.areaName}.` : "You are outside the cities we check."} ${coverageSentence()}`,
  };
}

export default function Home() {
  const settings = useSettings();
  const hydrated = useHydrated();
  const { fix } = useFlow();
  const [gpsOff, setGpsOff] = useState(false);
  const place = getPlace(settings.placeId);
  const { label: where, sentence: whereSentence } = describeWhere(settings.useGps, place.label, fix, gpsOff);

  // With GPS on, find the town as soon as Home opens, and keep it up to date.
  useEffect(() => {
    if (!hydrated || !settings.useGps) return;
    return watchFix(
      (f) => {
        setGpsOff(false);
        flowStore.set({ fix: f });
      },
      () => setGpsOff(true),
    );
  }, [hydrated, settings.useGps]);
  const trustedTel = telFromInput(settings.trustedPhone);
  const trustedName = settings.trustedName.trim();

  function readIt() {
    speak(
      `${whereSentence} Is this parking code real? ` +
        "To check, tap the big black button that says: Check a parking code.",
    );
  }

  return (
    <main className={`page ${styles.home}`}>
      <div className={styles.top}>
        <Link href="/settings" className={styles.gear} aria-label="Settings">
          <GearIcon />
        </Link>
        <Link href="/place" className={styles.chip} aria-label={`${whereSentence} Change place`}>
          <PinIcon className={styles.chipIcon} />
          <span className={styles.chipLabel}>{where}</span>
          <span className={styles.change}>Change</span>
        </Link>
      </div>

      <h1 className={styles.headline}>Is this parking code real?</h1>

      <div className="btn-stack">
        {/* The tap also lets iPhones read the verdict out loud later. */}
        <Link href="/scan" className={`btn btn-primary ${styles.big}`} onClick={primeSpeech}>
          <ScanIcon className={styles.bigIcon} />
          Check a parking code
        </Link>
        <Link href="/pay?here=1" className="btn btn-outline">
          <CardIcon />
          Pay without scanning
        </Link>
      </div>

      <div className="spacer" />

      <div className="btn-stack">
        {trustedName && trustedTel ? (
          <a href={`tel:${trustedTel}`} className="btn btn-outline">
            <PhoneIcon />
            Call {trustedName}
          </a>
        ) : (
          <Link href="/settings" className="btn btn-outline">
            <PhoneIcon />
            Add someone to call
          </Link>
        )}
        <button type="button" className="btn btn-outline" onClick={readIt}>
          <SpeakerIcon />
          Read it
        </button>
      </div>
    </main>
  );
}
