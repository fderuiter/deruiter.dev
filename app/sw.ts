import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    // The project compiles against the DOM lib, not webworker, so the one
    // worker event used directly here is declared by hand.
    addEventListener(
      type: "install",
      listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void
    ): void;
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

/**
 * The offline fallback itself, which `fallbacks` below serves but does not
 * precache, and the pages it lists as available offline. Keep the list in
 * step with `precachedRoutes` in `app/offline/page.tsx`; a test checks both.
 */
const OFFLINE_SHELL_ROUTES = ["/offline", "/", "/stack", "/arcade"];

/**
 * Stylesheets and fonts, the only build assets the offline shell needs.
 *
 * The injected manifest lists every JS chunk and every file in `public/`.
 * Precaching all of it made a first visit fetch about 600 files and 23 MB in
 * the background, including design source files no page uses (#3064), and
 * each of those is a CDN request against the Hobby plan's monthly allowance.
 * Scripts, images and pages a visitor actually opens are cached at runtime
 * by `defaultCache` instead. The full manifest still feeds `buildRevision`,
 * so a JS-only change still refreshes the precached shells.
 */
const OFFLINE_SHELL_ASSET =
  /^\/_next\/static\/(?:css\/[^/]+\.css|media\/[^/]+\.woff2)$/;

/** Build scripts, which the precached shells need to hydrate offline. */
const OFFLINE_SHELL_SCRIPT = /^\/_next\/static\/.+\.js$/;

const OFFLINE_SHELL_SCRIPTS_CACHE = "offline-shell-scripts";

/**
 * Saves the scripts the precached shells load, so they hydrate when the
 * visitor has no connection. Chunk names are content-hashed and only a
 * rendered page says which ones it needs, so they are read from each shell's
 * HTML at install rather than precached from the manifest. A failure here
 * leaves a shell as server-rendered HTML, which still reads correctly for
 * the fallback page.
 */
async function cacheOfflineShellScripts(): Promise<void> {
  try {
    const pages = await Promise.all(
      OFFLINE_SHELL_ROUTES.map(async (route) => (await fetch(route)).text())
    );
    const scripts = new Set(
      pages
        .flatMap((html) => [...html.matchAll(/src="([^"]+)"/g)])
        .map((match) => match[1])
        .filter((src) => OFFLINE_SHELL_SCRIPT.test(src))
    );
    await caches.delete(OFFLINE_SHELL_SCRIPTS_CACHE);
    const cache = await caches.open(OFFLINE_SHELL_SCRIPTS_CACHE);
    await cache.addAll([...scripts]);
  } catch {
    // Tolerated: see above.
  }
}

const precacheManifest = injectedManifest
  .filter((entry) =>
    OFFLINE_SHELL_ASSET.test(typeof entry === "string" ? entry : entry.url)
  )
  .concat(
    OFFLINE_SHELL_ROUTES.map((url) => ({
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
    // The SQL workbench's engine binary (#2633) is 34 MB and its file name
    // is content-hashed, so the browser's HTTP cache already keeps it; a
    // second copy in Cache Storage would only spend the visitor's disk.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/_next/static/media/duckdb-") &&
        url.pathname.endsWith(".wasm"),
      handler: new NetworkOnly(),
    },
    // Offline, a script is served from whichever cache holds it, including
    // the offline shell's scripts saved at install (below). Online, scripts
    // fall through to `defaultCache`.
    {
      matcher: ({ url }) =>
        navigator.onLine === false && OFFLINE_SHELL_SCRIPT.test(url.pathname),
      handler: async ({ request }) =>
        (await caches.match(request)) ?? fetch(request),
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

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflineShellScripts());
});

serwist.addEventListeners();
