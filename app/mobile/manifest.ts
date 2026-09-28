import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frederick de Ruiter | Mobile Systems & Software",
    short_name: "F. de Ruiter",
    description:
      "Touch-optimized mobile experience for clinical data systems, browser apps, and interactive showcases.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090D16",
    theme_color: "#06B6D4",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
