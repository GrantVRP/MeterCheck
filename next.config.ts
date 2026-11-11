// Copyright (c) 2026 Grant Patel. All rights reserved. See LICENSE.

import type { NextConfig } from "next";
import os from "node:os";

// Phones reach the dev server through a Cloudflare tunnel or the laptop's
// Wi-Fi address. Next.js blocks dev requests from hosts it doesn't know,
// so we list them here. This only matters in development.
function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
}

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: this app is almost all client-side
  // (camera, voice, screen-to-screen state), and plain unmount-on-navigate
  // makes camera and voice cleanup easy to reason about.
  cacheComponents: false,

  allowedDevOrigins: ["*.trycloudflare.com", ...lanAddresses()],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Only our own pages may use the camera and location.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
          // Never tell an outside site which page sent the user there.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Other sites can't embed us (clickjacking). Same-origin framing is allowed
          // so we can preview the app in a phone-sized frame on a laptop.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
