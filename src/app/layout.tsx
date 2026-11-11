// Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { SettingsEffects } from "@/components/SettingsEffects";
import { SETTINGS_KEY } from "@/lib/store";
import "./globals.css";

// Atkinson Hyperlegible was designed for low-vision readers. Only 400 and 700.
const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  title: "Meter Check",
  description: "Check if a parking code is real before you pay.",
  applicationName: "Meter Check",
  // We add phone links ourselves; stop iOS from turning other numbers into links.
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

// Applies the saved text size before the first paint, so large text never "jumps".
const textSizeScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");if(s.textSize&&s.textSize!=="normal")document.documentElement.dataset.text=s.textSize}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={atkinson.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; don't warn about it. */}
      <body suppressHydrationWarning>
        <SettingsEffects />
        {children}
      </body>
    </html>
  );
}
