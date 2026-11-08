"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/store";

/** Applies device settings to the whole app: text size, and the Demo tag. */
export function SettingsEffects() {
  const { textSize, demoMode } = useSettings();

  useEffect(() => {
    const html = document.documentElement;
    if (textSize === "normal") delete html.dataset.text;
    else html.dataset.text = textSize;
  }, [textSize]);

  return demoMode ? (
    <div className="demo-tag" aria-hidden="true">
      Demo
    </div>
  ) : null;
}
