// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon, CardIcon } from "@/components/Icons";
import { isFresh, pickedLocation, watchFix } from "@/lib/location";
import { getPlace } from "@/lib/places";
import { canUseCamera, createQrReader, openCamera } from "@/lib/qr";
import { DEMO_CODES, type DemoCode } from "@/lib/samples";
import { primeSpeech } from "@/lib/speech";
import { flowStore, settingsStore, useHydrated, useSettings } from "@/lib/store";
import type { PendingCheck } from "@/lib/types";
import styles from "./page.module.css";

const HELP_AFTER_MS = 10_000;
/** Time between looks at the camera picture. */
const READ_EVERY_MS = 150;

type Camera = "starting" | "on" | "off";

export default function Scan() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { demoMode, placeId, useGps } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCamera] = useState<Camera>("starting");
  // No camera at all (e.g. not https on a phone) counts as "off" too.
  const camera: Camera = hydrated && !canUseCamera() ? "off" : cameraState;
  const [attempt, setAttempt] = useState(0);
  const [offerPay, setOfferPay] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOfferPay(true), HELP_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  // A code was read: take the location, then go and check it.
  // The text is never shown or opened here. No photo is taken: the sign photo check isn't built.
  const onCode = useCallback(
    (text: string) => {
      navigator.vibrate?.(80);
      const s = settingsStore.get();
      const fix = flowStore.get().fix;
      const location = s.useGps ? (isFresh(fix) ? { lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy } : {}) : pickedLocation(s.placeId);
      const pending: PendingCheck = { url: text, source: s.useGps ? "gps" : "picked", ...location };
      flowStore.set({ pending, result: null });
      router.replace("/checking");
    },
    [router],
  );

  // Start the camera and keep reading until a code is found. Never gives up, never says "failed".
  useEffect(() => {
    if (!canUseCamera()) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;

    (async () => {
      try {
        stream = await openCamera();
      } catch {
        if (!stopped) setCamera("off");
        return;
      }
      if (stopped || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      setCamera("on");

      const reader = await createQrReader();
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          const text = await reader.read(video).catch(() => null);
          if (stopped) return;
          if (text && text.trim()) {
            stopped = true;
            onCode(text.trim());
            stream?.getTracks().forEach((t) => t.stop());
            return;
          }
        }
        timer = setTimeout(tick, READ_EVERY_MS);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [attempt, onCode]);

  // Ask for location only after the camera is on, so the phone asks one thing at a time.
  useEffect(() => {
    if (!hydrated || !useGps || camera !== "on") return;
    return watchFix((fix) => flowStore.set({ fix }));
  }, [hydrated, useGps, camera]);

  function pretend(code: DemoCode) {
    primeSpeech();
    settingsStore.set({ placeId: code.placeId, useGps: false });
    flowStore.set({
      pending: { url: code.url, source: "picked", ...pickedLocation(code.placeId) },
      result: null,
    });
    router.replace("/checking");
  }

  return (
    <main className={styles.scan}>
      <div className={styles.bar}>
        <Link href="/" className="pill">
          <BackIcon />
          Back
        </Link>
      </div>

      <p className={styles.prompt} aria-live="polite">
        {camera === "off" ? "The camera is off" : "Hold your phone over the code"}
      </p>

      <div className={styles.viewport}>
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          muted
          autoPlay
          aria-label="Camera view"
          hidden={camera === "off"}
        />
        {camera !== "off" && <div className={styles.guide} aria-hidden="true" />}
        {camera === "off" && (
          <div className={styles.off}>
            <p>To use it, allow the camera for this website in your phone&apos;s settings.</p>
            <button type="button" className="btn btn-white" onClick={() => {
              setCamera("starting");
              setAttempt((a) => a + 1);
            }}>
              Try the camera again
            </button>
          </div>
        )}
      </div>

      <div className={styles.bottom}>
        {(offerPay || camera === "off") && (
          <Link href="/pay?here=1" className="btn btn-white">
            <CardIcon />
            Pay without scanning
          </Link>
        )}

        {hydrated && demoMode && (
          <section className={styles.demo} aria-label="Demo codes">
            <p className={styles.demoTitle}>Demo: pretend to scan</p>
            <div className="btn-stack">
              {DEMO_CODES.map((c) => (
                <button key={c.id} type="button" className="btn btn-outline" onClick={() => pretend(c)}>
                  {c.label}
                </button>
              ))}
            </div>
            <p>
              {useGps ? "Using GPS." : `Place: ${getPlace(placeId).label}.`} Pretend codes switch to their own place.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
