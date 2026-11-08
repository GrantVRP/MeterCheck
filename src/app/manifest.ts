import type { MetadataRoute } from "next";

// Lets people add Meter Check to their home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meter Check",
    short_name: "Meter Check",
    description: "Check if a parking code is real before you pay.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
