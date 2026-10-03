import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { ChunkCycleGuardPlugin } from "./lib/dx/chunk-cycle-guard";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  // Precache all of public/ except videos: the arcade trailer is several
  // megabytes and plays on demand, so every visitor shouldn't download it (#1788).
  globPublicPatterns: ["*", "!(videos)/**/*"],
});

/** Route globs (picomatch, so bracketed segments match via wildcards) for every metadata image route. */
const OG_ROUTE_GLOBS = [
  "/opengraph-image",
  "/twitter-image",
  "/**/opengraph-image",
  "/**/twitter-image",
] as const;
const OG_TRACED_ASSETS = [
  "./assets/og-fonts/**/*",
  "./public/og/**/*",
] as const;
const OG_TRACING_INCLUDES: Record<string, string[]> = Object.fromEntries(
  OG_ROUTE_GLOBS.map((route) => [route, [...OG_TRACED_ASSETS]])
);

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },
  serverExternalPackages: [
    "ws",
    "bufferutil",
    "utf-8-validate",
    "@neondatabase/serverless",
    "@prisma/adapter-neon",
    "@prisma/client",
    "jsdom",
    "isomorphic-dompurify",
    "@exodus/bytes",
    "html-encoding-sniffer",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("bufferutil", "utf-8-validate");
    }
    // Fails the build on a cycle between runtime chunks instead of letting
    // webpack print a warning (AGENTS.md section 21, #853).
    config.plugins = config.plugins || [];
    config.plugins.push(new ChunkCycleGuardPlugin());
    return config;
  },
  // og-image.tsx reads fonts and artwork with fs.readFileSync(process.cwd()...),
  // which the file tracer cannot follow, so the assets never reached the
  // serverless bundle and Satori threw "No fonts are loaded" (#1674).
  outputFileTracingIncludes: OG_TRACING_INCLUDES,
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        source:
          "/:all*(svg|jpg|png|webp|avif|glb|obj|ico|txt|woff|woff2|ttf|eot|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Declared after the generic .txt rule so the regenerated manifests
        // revalidate hourly instead of being pinned for a year.
        source: "/:file(llms|llms-full).txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, must-revalidate",
          },
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/duck/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/transparency",
        destination: "/proof",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG || "dummy-org",
  project: process.env.SENTRY_PROJECT || "dummy-project",
  widenClientFileUpload: true,
  sourcemaps: {
    disable: false,
  },
});
