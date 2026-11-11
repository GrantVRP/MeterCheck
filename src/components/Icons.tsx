// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

// Bold, sign-style icons. All decorative: the words next to them carry the meaning.

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Stroke({ children, strokeWidth = 2.75, ...props }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ScanIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M7 12h10" />
  </Stroke>
);

/** Raised hand, like a "don't walk" signal. Filled. */
export const HandIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width="1.5em" height="1.5em" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <rect x="5.2" y="5" width="2.8" height="10" rx="1.4" />
    <rect x="8.5" y="2.5" width="2.8" height="12" rx="1.4" />
    <rect x="11.8" y="2" width="2.8" height="12.5" rx="1.4" />
    <rect x="15.1" y="4" width="2.8" height="11" rx="1.4" />
    <rect x="17.4" y="10.2" width="2.8" height="7.5" rx="1.4" transform="rotate(32 18.8 14)" />
    <rect x="5.2" y="10" width="12.7" height="12" rx="4.5" />
  </svg>
);

export const QuestionIcon = (p: P) => (
  <Stroke strokeWidth={3.25} {...p}>
    <path d="M8.5 8.5a3.5 3.5 0 1 1 5.2 3.06c-1 .55-1.7 1.4-1.7 2.54V15" />
    <circle cx="12" cy="19.3" r="0.6" fill="currentColor" strokeWidth={2.4} />
  </Stroke>
);

export const CheckIcon = (p: P) => (
  <Stroke strokeWidth={3.5} {...p}>
    <path d="M4.5 12.5l5 5L19.5 7" />
  </Stroke>
);

export const PhoneIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 3.1 3.7 2 2 0 0 1 5.1 1.5h3a2 2 0 0 1 2 1.7c.13.96.37 1.9.7 2.8a2 2 0 0 1-.45 2.1L9.1 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.33 1.84.57 2.8.7a2 2 0 0 1 1.7 2z" />
  </Stroke>
);

export const GearIcon = (p: P) => (
  <Stroke strokeWidth={2.25} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Stroke>
);

export const SpeakerIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M11 5 6 9H2.5v6H6l5 4V5z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Stroke>
);

export const PinIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </Stroke>
);

export const BackIcon = (p: P) => (
  <Stroke strokeWidth={3.25} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Stroke>
);

export const MapIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Stroke>
);

export const FlagIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2.5 4.5L17 13H5" fill="currentColor" />
  </Stroke>
);

export const ArrowOutIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Stroke>
);

export const CardIcon = (p: P) => (
  <Stroke {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19M6.5 15h4" />
  </Stroke>
);

export const DownloadIcon = (p: P) => (
  <Stroke {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
  </Stroke>
);
