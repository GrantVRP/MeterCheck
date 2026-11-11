// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

"use client";

// Street map of fake-code reports (Leaflet + OpenStreetMap, no key needed).
// Fake addresses are only ever written as plain text, "defanged", never as links.

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { defang, defangUrl, timeAgo } from "@/lib/format";
import { reportPlace, type Cluster } from "@/lib/reports";
import styles from "./ReportsMap.module.css";

type Leaflet = typeof import("leaflet");

interface Props {
  clusters: Cluster[];
  /** Centre here (e.g. your new report) instead of fitting every pin. */
  focus?: { lat: number; lon: number } | null;
  /** Small, still map with no buttons (the "Report sent" screen). */
  mini?: boolean;
  /** When this changes, the map moves to fit the pins again (e.g. a new city filter). */
  viewKey?: string;
  label: string;
  /** Owner area: full address, exact time, spot and reasons in each pop-up. */
  detail?: boolean;
}

/** Ontario, until there are pins to show. */
const ONTARIO: [number, number] = [44.2, -79.2];

export function ReportsMap({ clusters, focus = null, mini = false, viewKey = "", label, detail = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; pins: LayerGroup } | null>(null);
  const fittedFor = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // Leaflet needs the browser, so it is loaded here rather than on the server.
  useEffect(() => {
    let gone = false;
    import("leaflet").then((mod) => {
      const L = ((mod as unknown as { default?: Leaflet }).default ?? mod) as Leaflet;
      if (gone || !box.current) return;
      const map = L.map(box.current, {
        zoomControl: !mini,
        dragging: !mini,
        touchZoom: !mini,
        doubleClickZoom: !mini,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: !mini,
      });
      map.attributionControl.setPrefix(false);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        // The site sends no referrer anywhere else. The map tiles need one: just our site's name.
        referrerPolicy: "strict-origin-when-cross-origin",
      }).addTo(map);
      map.setView(ONTARIO, 6);
      leaflet.current = { L, map, pins: L.layerGroup().addTo(map) };
      setReady(true);
    });
    return () => {
      gone = true;
      leaflet.current?.map.remove();
      leaflet.current = null;
      fittedFor.current = null;
    };
  }, [mini]);

  useEffect(() => {
    const cur = leaflet.current;
    if (!ready || !cur) return;
    const { L, map, pins } = cur;
    pins.clearLayers();
    for (const c of clusters) {
      const n = c.reports.length;
      const marker =
        n === 1
          ? L.circleMarker([c.lat, c.lon], { radius: 12, color: "#111111", weight: 3, fillColor: "#ffd100", fillOpacity: 1 })
          : L.marker([c.lat, c.lon], {
              icon: L.divIcon({ className: styles.cluster, html: String(n), iconSize: [52, 52] }),
              title: c.label,
              alt: c.label,
            });
      if (!mini) marker.bindPopup(() => (detail ? detailPopup(c) : popupFor(c)), { maxWidth: 320 });
      marker.addTo(pins);
    }

    // Move the map only when what we're looking at changes, not on every refresh.
    const key = `${viewKey}|${focus ? `${focus.lat},${focus.lon}` : ""}`;
    if (fittedFor.current === key || (!focus && !clusters.length)) return;
    fittedFor.current = key;
    if (focus) map.setView([focus.lat, focus.lon], mini ? 16 : 15);
    else map.fitBounds(L.latLngBounds(clusters.map((c) => [c.lat, c.lon] as [number, number])).pad(0.3), { maxZoom: 15 });
  }, [ready, clusters, focus, mini, viewKey, detail]);

  return <div ref={box} className={`${styles.map} ${mini ? styles.mini : ""}`} role="region" aria-label={label} />;
}

/** The pin's pop-up, built as plain text so nothing in a report can run or be tapped. */
function popupFor(c: Cluster): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const head = document.createElement("strong");
  head.textContent = c.reports.length > 1 ? c.label : defang(c.reports[0].fake_host);
  el.append(head);
  for (const r of c.reports.slice(0, 5)) {
    const line = document.createElement("div");
    const parts = c.reports.length > 1 ? [defang(r.fake_host)] : [];
    parts.push(reportPlace(r), timeAgo(r.created_at));
    if (r.is_demo) parts.push("demo");
    line.textContent = parts.join(" · ");
    el.append(line);
  }
  if (c.reports.length > 5) {
    const more = document.createElement("div");
    more.textContent = `and ${c.reports.length - 5} more`;
    el.append(more);
  }
  return el;
}

/** Owner pop-up: everything about each report, still as plain text. */
function detailPopup(c: Cluster): HTMLElement {
  const el = document.createElement("div");
  el.className = `${styles.popup} ${styles.detail}`;
  const head = document.createElement("strong");
  head.textContent = c.reports.length > 1 ? c.label : "1 report";
  el.append(head);
  for (const r of c.reports) {
    const item = document.createElement("div");
    item.className = styles.item;
    const lines = [
      new Date(r.created_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }),
      reportPlace(r) + (r.lat != null && r.lon != null ? ` (${r.lat}, ${r.lon})` : ""),
      defangUrl(r.fake_url),
      ...r.verdict_reasons.slice(0, 3),
      ...(r.is_demo ? ["Demo code"] : []),
    ];
    for (const text of lines) {
      const line = document.createElement("div");
      line.textContent = text;
      item.append(line);
    }
    el.append(item);
  }
  return el;
}
