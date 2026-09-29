import { defaultCache } from "@serwist/next/worker";
import { PUBLIC_ROUTE_PATHS } from "@/lib/public-routes";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, type PrecacheEntry } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const injectedManifest = self.__SW_MANIFEST || [];

/**
 * A fingerprint of this build, derived from the manifest Serwist injects.
 *
 * The precached routes are real HTML documents, not content-hashed assets, so
 * they need revision information. `revision: null` tells Serwist the URL is
 * already self-versioned: `createCacheKey` then uses the bare URL as the cache
 * key, identical on every deployment forever. `handleActivate` only deletes
 * cache entries whose key is absent from the current manifest, and a bare URL
 * never is -- so those documents were fetched once, on the visitor's first
 * install, and served from cache for the life of the browser profile. Their
 * embedded `/_next/static/chunks/<buildId>/...` scripts stop existing after
 * the next deployment, which is what broke the arcade in production while a
 * freshly installed origin worked fine.
 *
 * Precaching every entry in PUBLIC_ROUTE_PATHS makes that matter more, not
 * less: it is the whole public surface rather than ten shells.
 *
 * The injected manifest changes whenever any precached asset changes, so
 * hashing it gives a per-build revision with no extra build plumbing. The
 * cache key then changes every deployment: the new one is fetched on install,
 * and the previous one, no longer expected, is deleted on activate. That
 * heals visitors already holding a stale shell.
 */
const buildRevision = (() => {
  const serialized = JSON.stringify(injectedManifest);
  // djb2. Not cryptographic -- it only has to change when the build does.
  let hash = 5381;
  for (let i = 0; i < serialized.length; i++) {
    hash = ((hash << 5) + hash + serialized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
})();

const precacheManifest = injectedManifest.concat(
  PUBLIC_ROUTE_PATHS.map((url) => ({
    url,
    revision: buildRevision,
  }))
);

const serwist = new Serwist({
  precacheEntries: precacheManifest,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Requirement 4: Enforce strictly Network-Only strategy for telemetry and Sentry error tracking
    {
      matcher: ({ url }) => {
        const { pathname, hostname } = url;
        return (
          pathname.startsWith("/api/telemetry") ||
          hostname.includes("sentry") ||
          pathname.includes("sentry")
        );
      },
      handler: new NetworkOnly(),
    },
    // Requirement 2: Apply Cache-First runtime strategy for 3D model files while preserving fallbacks
    {
      matcher: ({ url }) => {
        const { pathname } = url;
        return (
          /\.(?:glb|gltf|obj)$/i.test(pathname) ||
          pathname.startsWith("/models/")
        );
      },
      handler: new CacheFirst({
        cacheName: "3d-models-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          // Only stand in for a document when the browser reports no
          // connectivity. Without this check a slow or failed request for a
          // page the visitor can actually reach is presented as "you are
          // offline". navigator.onLine is only trustworthy when false, which
          // is the direction being relied on here.
          return request.destination === "document" && !navigator.onLine;
        },
      },
    ],
  },
});

serwist.addEventListeners();
