"use client";

// Tiny shared state that survives navigation between screens.
// - settings: saved on this device (localStorage), never sent to the server.
// - flow: the current check, kept for this tab only (sessionStorage).

import { useSyncExternalStore } from "react";
import { DEFAULT_PLACE, type PlaceId } from "./places";
import type { CheckResult, Fix, PendingCheck, Report } from "./types";

type Listener = () => void;

function createStore<T extends object>(key: string, kind: "local" | "session", initial: T) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<Listener>();
  const storage = () => {
    if (typeof window === "undefined") return null;
    try {
      return kind === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return null; // private mode or storage blocked
    }
  };

  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const saved = storage()?.getItem(key);
      if (saved) state = { ...initial, ...JSON.parse(saved) };
    } catch {
      /* ignore broken saved data */
    }
  }

  return {
    initial,
    get(): T {
      load();
      return state;
    },
    set(patch: Partial<T>) {
      load();
      state = { ...state, ...patch };
      try {
        storage()?.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full or blocked: keep it in memory */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

// ---------- settings ----------

export type TextSize = "normal" | "large" | "xlarge";

export interface Settings {
  voice: boolean;
  textSize: TextSize;
  trustedName: string;
  trustedPhone: string;
  demoMode: boolean;
  /** The place picked on the Change screen. */
  placeId: PlaceId;
  /** true: use the phone's GPS (the default). false: use the picked place. */
  useGps: boolean;
}

export const SETTINGS_KEY = "mc-settings";

export const settingsStore = createStore<Settings>(SETTINGS_KEY, "local", {
  voice: true,
  textSize: "normal",
  trustedName: "",
  trustedPhone: "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  placeId: DEFAULT_PLACE,
  useGps: true,
});

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, () => settingsStore.initial);
}

// ---------- current check ----------

export interface Flow {
  pending: PendingCheck | null;
  result: CheckResult | null;
  lastReport: Report | null;
  /** How sending the last report went. */
  reportStatus: "sending" | "sent" | "failed" | null;
  /** Which check (its checkedAt) the last report was for, so one check is reported once. */
  reportFor: string | null;
  /** Where the last check was made (GPS or picked place), if the phone knew. */
  spot: { lat: number; lon: number } | null;
  /** Latest GPS reading. */
  fix: Fix | null;
}

export const flowStore = createStore<Flow>("mc-flow", "session", {
  pending: null,
  result: null,
  lastReport: null,
  reportStatus: null,
  reportFor: null,
  spot: null,
  fix: null,
});

export function useFlow(): Flow {
  return useSyncExternalStore(flowStore.subscribe, flowStore.get, () => flowStore.initial);
}

/** True after the first render in the browser (stored values are loaded by then). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
