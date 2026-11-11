// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

"use client";

// Reads text out loud with the browser's built-in voice.

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-CA";
  u.rate = 0.9; // a little slower than normal, easier to follow
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/**
 * iPhones only let a page talk after a tap. Call this from a tap (e.g. "Check a parking code")
 * so the verdict can be read out by itself a moment later. Says nothing.
 */
export function primeSpeech(): void {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
