// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

"use client";

import { Fragment, useEffect, useSyncExternalStore } from "react";
import { ArrowOutIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";
import { getFix } from "@/lib/location";
import type { AppLinks } from "@/lib/places";
import { flowStore, useFlow, useHydrated, useSettings } from "@/lib/store";
import { useTown } from "@/lib/useTown";
import { hasZones, machineNote, payApps } from "@/lib/where";
import { usePlatform, type Platform } from "@/lib/usePlatform";
import styles from "./page.module.css";

/** True when opened as /pay?here=1 (from Home or the scanner): about where you are now, not an older check. */
function useFromHome(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("here") === "1",
    () => false,
  );
}

/** What to do, in one or two short sentences. The zone number is typed into the app, not here. */
function payStep(apps: AppLinks[], zones: boolean): string {
  if (!zones) return `Pay with the official ${apps.length > 1 ? "apps" : "app or website"}:`;
  if (apps.length > 1) return "Open the parking app named on the sign. Then type the zone number from the sign.";
  const app = apps[0];
  const open = app.ios || app.android ? `Open the ${app.name} app.` : `Go to ${app.web?.label ?? app.name}.`;
  return `${open} Then type the zone number from the sign.`;
}

export default function Pay() {
  const hydrated = useHydrated();
  const { result, fix } = useFlow();
  const { useGps } = useSettings();
  const fromHome = useFromHome();
  const platform = usePlatform();

  const town = useTown({ ignoreResult: fromHome });
  const apps = payApps(town);
  const machine = machineNote(town);
  const backHref = fromHome || !result ? "/" : "/verdict";

  // Came straight from Home with GPS on: find the town, so we can name its app.
  useEffect(() => {
    if (!fromHome || !useGps || fix) return;
    let live = true;
    getFix(8000).then((f) => {
      if (live && f) flowStore.set({ fix: f });
    });
    return () => {
      live = false;
    };
  }, [fromHome, useGps, fix]);

  return (
    <main className="page">
      <TopBar href={backHref} />
      <h1>Pay without scanning</h1>

      {hydrated && apps.length > 0 && (
        <>
          <p className="lead">{payStep(apps, hasZones(town))}</p>
          <div className="btn-stack">
            {apps.map((app) => (
              <AppButtons key={app.name} app={app} platform={platform} />
            ))}
          </div>
        </>
      )}

      {hydrated && (
        <section className={styles.machine}>
          <h2 className={styles.machineTitle}>{machine.headline}</h2>
          <p className="lead">{machine.detail}</p>
        </section>
      )}
    </main>
  );
}

function AppButtons({ app, platform }: { app: AppLinks; platform: Platform }) {
  const links: { href: string; label: string; primary: boolean; note?: string }[] = [];
  // A website can't open another company's app directly unless that company sets it up (HotSpot hasn't),
  // so the button goes to the app's store page, which has an Open button. Say so, so nobody is surprised.
  const storeNote = (store: string) => `Your phone shows ${app.name} in ${store} first. Tap Open.`;
  if (platform === "ios" && app.ios)
    links.push({ href: app.ios, label: `Open the ${app.name} app`, primary: true, note: storeNote("the App Store") });
  else if (platform === "android" && app.android)
    links.push({ href: app.android, label: `Open the ${app.name} app`, primary: true, note: storeNote("Google Play") });
  else {
    // Laptop or unknown phone: offer both stores, stacked.
    if (app.ios) links.push({ href: app.ios, label: `${app.name} for iPhone`, primary: true });
    if (app.android) links.push({ href: app.android, label: `${app.name} for Android`, primary: true });
  }
  // The website is the main button when there's no app to open.
  if (app.web) links.push({ href: app.web.url, label: `Pay on ${app.web.label}`, primary: links.length === 0 });

  return (
    <>
      {links.map((l) => (
        <Fragment key={l.href}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn ${l.primary ? "btn-primary" : "btn-outline"}`}
          >
            <ArrowOutIcon />
            {l.label}
          </a>
          {l.note && <p className={styles.storeNote}>{l.note}</p>}
        </Fragment>
      ))}
    </>
  );
}
