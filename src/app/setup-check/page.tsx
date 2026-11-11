// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

"use client";

// Developer page: checks that this phone can use the camera, location and
// voice over the current link, and previews the design tokens.
// Not part of the user's path.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WORDS } from "@/lib/words";
import styles from "./page.module.css";

type Status = "yes" | "no" | "checking";

interface Support {
  secure: Status;
  camera: Status;
  barcode: Status;
  voice: Status;
  origin: string;
}

export default function SetupCheck() {
  const [support, setSupport] = useState<Support>({
    secure: "checking",
    camera: "checking",
    barcode: "checking",
    voice: "checking",
    origin: "",
  });
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraMsg, setCameraMsg] = useState("");
  const [locationMsg, setLocationMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function detect() {
      let barcode: Status = "no";
      if ("BarcodeDetector" in window) {
        try {
          // @ts-expect-error BarcodeDetector is not in TypeScript's DOM types yet
          const formats: string[] = await window.BarcodeDetector.getSupportedFormats();
          barcode = formats.includes("qr_code") ? "yes" : "no";
        } catch {
          barcode = "no";
        }
      }
      setSupport({
        secure: window.isSecureContext ? "yes" : "no",
        camera: typeof navigator.mediaDevices?.getUserMedia === "function" ? "yes" : "no",
        barcode,
        voice: "speechSynthesis" in window ? "yes" : "no",
        origin: window.location.origin,
      });
    }
    detect();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function toggleCamera() {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      setCameraMsg("");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setCameraMsg("Camera works.");
      // The video element renders after cameraOn flips, so attach on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (err) {
      setCameraMsg(`Camera blocked: ${(err as Error).name}. Is this an https link?`);
    }
  }

  function testLocation() {
    if (!navigator.geolocation) {
      setLocationMsg("No location on this device.");
      return;
    }
    setLocationMsg("Finding you...");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setLocationMsg(
          `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)} (within ${Math.round(p.coords.accuracy)} m)`,
        ),
      (e) => setLocationMsg(`Location blocked: ${e.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function testVoice() {
    const u = new SpeechSynthesisUtterance(WORDS.stop);
    u.lang = "en-CA";
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  const rows: [string, Status | string][] = [
    ["Secure page (https)", support.secure],
    ["Camera", support.camera],
    ["Built-in code reader", support.barcode],
    ["Voice", support.voice],
  ];

  return (
    <main className={styles.main}>
      <h1>Phone check</h1>
      <p className={styles.origin}>{support.origin}</p>

      <ul className={styles.status}>
        {rows.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <strong data-ok={value === "yes"}>{value === "yes" ? "Yes" : value === "no" ? "No" : "..."}</strong>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        &quot;Built-in code reader&quot; can be No on iPhone. That&apos;s fine: we use a backup reader.
      </p>

      <div className="btn-stack">
        <button className="btn btn-primary" onClick={toggleCamera}>
          {cameraOn ? "Stop camera" : "Test camera"}
        </button>
        {cameraMsg && <p role="status">{cameraMsg}</p>}
        {cameraOn && <video ref={videoRef} className={styles.video} autoPlay playsInline muted />}

        <button className="btn btn-outline" onClick={testLocation}>
          Test location
        </button>
        {locationMsg && <p role="status">{locationMsg}</p>}

        <button className="btn btn-outline" onClick={testVoice}>
          Test voice
        </button>
      </div>

      <h2 className={styles.h2}>Colours</h2>
      <div className={styles.swatches}>
        {[
          ["--ink", "#111111"],
          ["--paper", "#FFFFFF"],
          ["--sign-yellow", "#FFD100"],
          ["--stop-red", "#A3161A"],
          ["--safe-green", "#0B5D2A"],
          ["--muted", "#444444"],
        ].map(([token, hex]) => (
          <div key={token} className={styles.swatch}>
            <span className={styles.chip} style={{ background: `var(${token})` }} />
            <span>
              <strong>{token}</strong> {hex}
            </span>
          </div>
        ))}
      </div>

      <h2 className={styles.h2}>Type scale</h2>
      <div className={styles.type}>
        <p style={{ fontSize: "var(--fs-body)" }}>Body 20 px: Pay at the machine.</p>
        <p style={{ fontSize: "var(--fs-sentence)" }}>Sentence 23 px: This code goes to a fake website.</p>
        <p style={{ fontSize: "var(--fs-heading)", fontWeight: 700, lineHeight: 1.15 }}>Heading 40 px</p>
        <p style={{ fontSize: "var(--fs-verdict)", fontWeight: 700, lineHeight: 1.15 }}>{WORDS.stop}</p>
        <p className={styles.zone}>1001</p>
      </div>

      <h2 className={styles.h2}>Buttons</h2>
      <div className="btn-stack">
        <button className="btn btn-primary">Check a parking code</button>
        <button className="btn btn-outline">Pay without scanning</button>
      </div>
      <div className={`on-color ${styles.redPanel}`}>
        <p style={{ fontSize: "var(--fs-verdict)", fontWeight: 700, lineHeight: 1.15 }}>{WORDS.stop}</p>
        <div className="btn-stack">
          <button className="btn btn-primary">Go to the real site</button>
          <button className="btn btn-outline">Call for help</button>
        </div>
      </div>

      <Link href="/" className="btn btn-outline">
        Back
      </Link>
    </main>
  );
}
