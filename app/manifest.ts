import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frederick de Ruiter | Principal Systems Engineer & Designer",
    short_name: "F. de Ruiter",
    description:
      "A high-performance design engineering showcase combining DOM-free canvas layout physics, serverless Neon Postgres data streams, and robust clinical CDISC data engines.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#090D16",
    theme_color: "#090D16",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
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
