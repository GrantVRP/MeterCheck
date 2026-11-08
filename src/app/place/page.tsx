"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PinIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
import { checkPlace } from "@/lib/checks/place";
import { canUseGps, getFix, pickedLocation } from "@/lib/location";
import { PLACES, type PlaceId } from "@/lib/places";
import { coverageNote } from "@/lib/registry";
import { flowStore, settingsStore, useHydrated, useSettings } from "@/lib/store";
import styles from "./page.module.css";

// Choose where you are: GPS, or one of our places by hand.
// Picking by hand overrides GPS, so the demo works indoors.

type Finding = "idle" | "finding" | "off";

/** True when opened from the grey "Wrong town?" screen: check the same code again at the new place. */
function useRecheck(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("recheck") === "1",
    () => false,
  );
}

export default function PlacePicker() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { placeId, demoMode, useGps } = useSettings();
  const [finding, setFinding] = useState<Finding>("idle");
  const recheck = useRecheck();

  /** Back Home, or (from "Wrong town?") straight to checking the same code at the new place. */
  function done(spot: { lat: number; lon: number; accuracy: number }, source: "gps" | "picked") {
    const pending = flowStore.get().pending;
    if (recheck && pending) {
      flowStore.set({ pending: { url: pending.url, source, ...spot } });
      router.replace("/checking");
    } else {
      router.push("/");
    }
  }

  function choose(id: PlaceId) {
    settingsStore.set({ placeId: id, useGps: false });
    done(pickedLocation(id), "picked");
  }

  async function useMyLocation() {
    if (!canUseGps()) {
      setFinding("off");
      return;
    }
    setFinding("finding");
    const fix = await getFix(15_000);
    if (!fix) {
      setFinding("off");
      return;
    }
    flowStore.set({ fix });
    const where = checkPlace(fix);
    settingsStore.set({ useGps: true, ...(where.placeId ? { placeId: where.placeId } : {}) });
    done({ lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy }, "gps");
  }

  const gpsChosen = hydrated && useGps;

  return (
    <main className="page">
      <TopBar href={recheck ? "/verdict" : "/"} />
      <h1>Where are you?</h1>
      {recheck ? <p className="panel panel-yellow">Tell us where you are. We&apos;ll check the same code again.</p> : <p>{coverageNote()}</p>}

      <div className="btn-stack">
        <button
          type="button"
          className={`btn ${gpsChosen ? "btn-primary" : "btn-outline"} ${styles.place}`}
          aria-pressed={gpsChosen}
          onClick={useMyLocation}
          disabled={finding === "finding"}
        >
          {gpsChosen ? <CheckIcon /> : <PinIcon />}
          <span className={styles.text}>
            <span>{finding === "finding" ? "Finding you…" : "Use my location"}</span>
            <span className={styles.city}>Uses your phone&apos;s GPS</span>
          </span>
        </button>
        {finding === "off" && (
          <p className="panel panel-yellow" role="status">
            Your phone didn&apos;t share its location. Pick your place below.
          </p>
        )}
      </div>

      <h2 className={styles.or}>Or pick a place</h2>
      {hydrated && demoMode && <p className="panel panel-yellow">Demo mode: a place you pick is used instead of GPS.</p>}

      <div className="btn-stack">
        {PLACES.map((p) => {
          const chosen = hydrated && !useGps && p.id === placeId;
          return (
            <button
              key={p.id}
              type="button"
              className={`btn ${chosen ? "btn-primary" : "btn-outline"} ${styles.place}`}
              aria-pressed={chosen}
              onClick={() => choose(p.id)}
            >
              {chosen ? <CheckIcon /> : <PinIcon />}
              <span className={styles.text}>
                <span>{p.label}</span>
                <span className={styles.city}>
                  {p.city.name}, {p.city.province}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
