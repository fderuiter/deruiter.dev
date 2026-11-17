import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import {
  PIPELINE_SIMULATOR_LEGACY_PATH,
  PIPELINE_SIMULATOR_PATH,
} from "./lib/clinical-tools/pipeline-simulator";
import { ChunkCycleGuardPlugin } from "./lib/dx/chunk-cycle-guard";
import { securityHeaderRules } from "./lib/security-headers";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  // Precache all of public/ except videos: the arcade trailer is several
  // megabytes and plays on demand, so every visitor shouldn't download it (#1788).
  globPublicPatterns: ["*", "!(videos)/**/*"],
  // The SQL workbench's engine (#2633) is a 34 MB binary and its worker,
  // fetched only when a visitor starts it, so they are not precached either.
  // The first two patterns are Serwist's defaults, which this list replaces.
  exclude: [/\.map$/, /^manifest.*\.js$/, /^static\/media\/duckdb-/],
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
  // Screenshot cards (lib/og-arcade-showcase.tsx) read the arcade previews.
  "./public/images/arcade/previews/**/*",
] as const;
const OG_TRACING_INCLUDES: Record<string, string[]> = Object.fromEntries(
  OG_ROUTE_GLOBS.map((route) => [route, [...OG_TRACED_ASSETS]])
);

const nextConfig: NextConfig = {
  // Inlined at build time and read by buildTimestamp() in lib/env.ts, so
  // GET /api/version can say when the serving deployment was built (#2534).
  env: {
    BUILD_TIMESTAMP: new Date().toISOString(),
  },
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
      // The SQL workbench's engine runs only in the browser, after a click
      // (#2633). Resolved on the server, the package's Node build is bundled
      // for nothing and its binaries would be traced into the function.
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@duckdb/duckdb-wasm": false,
      };
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
  // scripts/build.js type-checks in its own phase before `next build`, with
  // route types from `next typegen`. Next's in-build checker would run the
  // same tsc while the build still holds its webpack heap, which ran Vercel's
  // 8 GB build machine out of memory (#2100). This skips only that duplicate.
  typescript: {
    ignoreBuildErrors: true,
  },
  // `next dev` keeps a managed block at the top of AGENTS.md when it detects
  // a coding agent (#3191). It stays on, and the committed block matches what
  // Next writes, so a dev server leaves the tree clean;
  // __tests__/agents-rule-index.test.ts fails when they drift apart.
  agentRules: true,
  // Drops the X-Powered-By: Next.js header, which only advertises the stack.
  poweredByHeader: false,
  experimental: {
    // Off (the default): no feedback block in AGENTS.md, and no agent
    // feedback reporting to Vercel.
    agentFeedback: false,
    optimizePackageImports: ["@tabler/icons-react"],
    // The webpack compile itself outgrew Vercel's 8 GB build machine on
    // 2026-10-28 (OOM SIGKILL in "Creating an optimized production build").
    // Measured on 2 cores, this cut the compile peak from ~8.1 GB to ~6.3 GB
    // and the whole build from ~9.8 GB to ~7.0 GB, for a slightly slower
    // compile. Remove it only with a fresh memory measurement.
    webpackMemoryOptimizations: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      // Served here rather than from the proxy so static and ISR pages carry
      // them without a function invocation (#1900).
      ...securityHeaderRules(),
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
        // The pipeline simulator is a workbench, so it left the arcade
        // (#1841) and then moved under Clinical (#3167). Old links, search
        // results and bookmarks follow in one hop.
        source: "/arcade/protocol-drift",
        destination: PIPELINE_SIMULATOR_PATH,
        permanent: true,
      },
      {
        source: PIPELINE_SIMULATOR_LEGACY_PATH,
        destination: PIPELINE_SIMULATOR_PATH,
        permanent: true,
      },
      {
        source: "/transparency",
        destination: "/proof",
        permanent: true,
      },
      {
        // Retired duplicate of the Equipose case study, which made compliance
        // claims the source does not support. Its seed row is unpublished (#1781).
        source: "/case-studies/equipose",
        destination: "/case-studies/equipose-randomization",
        permanent: true,
      },
      {
        // The old feed address. A config redirect answers at the edge, so
        // it no longer runs a function per request (#3204).
        source: "/feed.xml",
        destination: "/blog/rss.xml",
        statusCode: 301,
      },
      // Legacy mobile studio paths redirect permanently to canonical studio URLs.
      {
        source: "/m/:studio/:path*",
        destination: "/:studio/:path*",
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
  // Generating source maps for Sentry pushed the webpack compile past its
  // heap cap on Vercel's 8 GB build machine (2026-10-28): with maps the
  // compile ran out of heap at 3584 MB, without them it finished with room
  // to spare. Errors still reach Sentry; their stack traces show minified
  // frames until maps come back with build headroom to pay for them.
  sourcemaps: {
    disable: true,
  },
});
