import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fuel Dip Calculator",
    short_name: "Fuel Dip",
    description:
      "Safe discharge sheet for fuel delivery — dip chart volumes, ullage, and reconciliation.",
    start_url: "/calculator",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12141a",
    theme_color: "#12141a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
