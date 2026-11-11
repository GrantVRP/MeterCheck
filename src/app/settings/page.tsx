// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

"use client";

import Link from "next/link";
import { MapIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
import { settingsStore, useHydrated, useSettings, type TextSize } from "@/lib/store";
import styles from "./page.module.css";

const SIZES: { value: TextSize; label: string; scale: number }[] = [
  { value: "normal", label: "Normal", scale: 1 },
  { value: "large", label: "Large", scale: 1.15 },
  { value: "xlarge", label: "Extra large", scale: 1.3 },
];

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`btn btn-outline ${styles.switch}`}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className={`${styles.state} ${checked ? styles.on : ""}`}>{checked ? "On" : "Off"}</span>
    </button>
  );
}

export default function Settings() {
  const hydrated = useHydrated();
  const s = useSettings();
  if (!hydrated) return null;

  return (
    <main className="page">
      <TopBar />
      <h1>Settings</h1>

      <Switch label="Read results out loud" checked={s.voice} onChange={(voice) => settingsStore.set({ voice })} />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Text size</legend>
        <div className="btn-stack">
          {SIZES.map((size) => (
            <label key={size.value} className={`btn btn-outline ${styles.option} ${s.textSize === size.value ? styles.chosen : ""}`}>
              <input
                type="radio"
                name="text-size"
                className="sr-only"
                checked={s.textSize === size.value}
                onChange={() => settingsStore.set({ textSize: size.value })}
              />
              <span style={{ fontSize: `${1.25 * size.scale}rem` }}>{size.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Trusted person</legend>
        <p>Someone you can call for help. Saved on this phone only.</p>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Name</span>
          <input
            className={styles.input}
            value={s.trustedName}
            autoComplete="off"
            onChange={(e) => settingsStore.set({ trustedName: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Phone number</span>
          <input
            className={styles.input}
            type="tel"
            inputMode="tel"
            value={s.trustedPhone}
            autoComplete="off"
            onChange={(e) => settingsStore.set({ trustedPhone: e.target.value })}
          />
        </label>
      </fieldset>

      <section className={styles.group}>
        <h2 className={styles.legend}>Fake code map</h2>
        <p>See fake codes other people have reported.</p>
        <Link href="/map" className="btn btn-outline">
          <MapIcon />
          See the map
        </Link>
      </section>

      <Switch label="Demo mode" checked={s.demoMode} onChange={(demoMode) => settingsStore.set({ demoMode })} />
    </main>
  );
}
