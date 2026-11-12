import type { PrecacheEntry } from "serwist";
import type { RunSnapshot, RunSnapshotStorage } from "@/lib/arcade";
import type { StudyProtocol } from "@/lib/crf";
import { STUDY_DRAFT_ENVELOPE_VERSION, STUDY_DRAFT_STORAGE_KEY } from "@/lib/crf";
import { runSnapshotKey } from "@/lib/arcade";

/**
 * Standard isolated MockStorage honoring Invariant 1.
 * Supports configurable denial for testing quota/permission failures.
 */
export class MockStorage implements Storage, RunSnapshotStorage {
  private store = new Map<string, string>();
  private _denyReads = false;
  private _denyWrites = false;

  get length(): number {
    return this.store.size;
  }

  setDenyReads(deny: boolean): void {
    this._denyReads = deny;
  }

  setDenyWrites(deny: boolean): void {
    this._denyWrites = deny;
  }

  getItem(key: string): string | null {
    if (this._denyReads) {
      throw new DOMException("The operation is insecure.", "SecurityError");
    }
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this._denyWrites) {
      throw new DOMException("Quota exceeded.", "QuotaExceededError");
    }
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  entries(): Record<string, string> {
    return Object.fromEntries(this.store.entries());
  }
}

/** Synthetic Response stub for MockCache */
export class SyntheticResponse {
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  private readonly _body: string;
  readonly headers: Map<string, string>;

  constructor(body: string, init?: { status?: number; statusText?: string; headers?: Record<string, string> }) {
    this._body = body;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? (this.status === 200 ? "OK" : "Error");
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Map(Object.entries(init?.headers ?? {}));
  }

  async text(): Promise<string> {
    return this._body;
  }

  async json<T = unknown>(): Promise<T> {
    return JSON.parse(this._body) as T;
  }

  clone(): SyntheticResponse {
    return new SyntheticResponse(this._body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers.entries()),
    });
  }
}

/**
 * Isolated Cache Storage simulation for Service Worker precache and runtime caches.
 */
export class MockCache {
  readonly name: string;
  private readonly items = new Map<string, SyntheticResponse>();

  constructor(name: string) {
    this.name = name;
  }

  private normalizeKey(request: string | { url: string }): string {
    const raw = typeof request === "string" ? request : request.url;
    try {
      const parsed = new URL(raw, "https://deruiter.dev");
      return parsed.pathname;
    } catch {
      return raw;
    }
  }

  async match(request: string | { url: string }): Promise<SyntheticResponse | undefined> {
    const key = this.normalizeKey(request);
    const item = this.items.get(key);
    return item ? item.clone() : undefined;
  }

  async put(request: string | { url: string }, response: SyntheticResponse): Promise<void> {
    const key = this.normalizeKey(request);
    this.items.set(key, response.clone());
  }

  async add(request: string): Promise<void> {
    const key = this.normalizeKey(request);
    this.items.set(key, new SyntheticResponse(`/* cached: ${key} */`));
  }

  async addAll(requests: string[]): Promise<void> {
    for (const req of requests) {
      await this.add(req);
    }
  }

  async delete(request: string | { url: string }): Promise<boolean> {
    const key = this.normalizeKey(request);
    return this.items.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.items.keys()];
  }
}

export class MockCacheStorage {
  private readonly caches = new Map<string, MockCache>();

  async open(name: string): Promise<MockCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MockCache(name);
      this.caches.set(name, cache);
    }
    return cache;
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async match(request: string | { url: string }, options?: { cacheName?: string }): Promise<SyntheticResponse | undefined> {
    if (options?.cacheName) {
      const cache = this.caches.get(options.cacheName);
      return cache ? cache.match(request) : undefined;
    }
    for (const cache of this.caches.values()) {
      const match = await cache.match(request);
      if (match) return match;
    }
    return undefined;
  }
}

export type BuildGenerationId = "gen-1" | "gen-2";

/**
 * Manifest definition for each build generation.
 */
export interface BuildGenerationConfig {
  readonly id: BuildGenerationId;
  readonly shellScriptChunk: string;
  readonly featureChunk: string;
  readonly stylesheet: string;
  readonly fontAsset: string;
  readonly sharedAsset: string;
  readonly htmlRoutes: Record<string, string>;
}

/**
 * Derives a build fingerprint from manifest entries matching app/sw.ts djb2 implementation.
 */
export function deriveBuildRevision(manifest: (PrecacheEntry | string)[]): string {
  const serialized = JSON.stringify(manifest);
  let hash = 5381;
  for (let i = 0; i < serialized.length; i++) {
    hash = ((hash << 5) + hash + serialized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Audit log recording transition state for Acceptance Check 4 & R10 verification.
 */
export interface PwaUpgradeAuditRecord {
  timestamp: number;
  phase: string;
  browserCommand: string;
  controllerGeneration: BuildGenerationId | null;
  online: boolean;
  documentRoute: string;
  servedDocumentGeneration: BuildGenerationId | "offline-fallback" | "unavailable";
  servedScripts: string[];
  arcadeSaveIdentity: { slug: string; schema: number; score?: number; wave?: number; discarded?: boolean } | null;
  clinicalDraftIdentity: { studyId: string; envelopeVersion: number; formsCount?: number; savedAt?: string } | null;
  recoveryNotice: string | null;
}

/**
 * Service Worker simulation adhering to app/sw.ts invariants.
 */
export class MockSerwistWorker {
  readonly generation: BuildGenerationId;
  readonly buildRevision: string;
  readonly manifest: (PrecacheEntry | string)[];
  readonly config: BuildGenerationConfig;
  state: "installing" | "installed" | "activating" | "activated" = "installing";

  constructor(config: BuildGenerationConfig) {
    this.generation = config.id;
    this.config = config;
    this.manifest = [
      { url: config.stylesheet, revision: null },
      { url: config.fontAsset, revision: `${config.id}-font-hash` },
      { url: config.sharedAsset, revision: "shared-font-hash-v1" },
      { url: config.shellScriptChunk, revision: null },
      { url: config.featureChunk, revision: null },
    ];
    this.buildRevision = deriveBuildRevision(this.manifest);
  }

  async install(caches: MockCacheStorage): Promise<void> {
    this.state = "installing";
    // Mimic app/sw.ts cacheOfflineShellScripts()
    await caches.delete("offline-shell-scripts");
    const scriptCache = await caches.open("offline-shell-scripts");
    await scriptCache.put(
      this.config.shellScriptChunk,
      new SyntheticResponse(`/* generation ${this.generation} shell script */`, {
        headers: { "content-type": "application/javascript" },
      })
    );

    // Precache shell routes and static assets with revision: buildRevision
    const precache = await caches.open(`serwist-precache-${this.buildRevision}`);
    for (const [route, html] of Object.entries(this.config.htmlRoutes)) {
      await precache.put(route, new SyntheticResponse(html, { headers: { "content-type": "text/html" } }));
    }
    // Precache stylesheets and fonts matching OFFLINE_SHELL_ASSET in app/sw.ts
    await precache.put(
      this.config.stylesheet,
      new SyntheticResponse(`/* generation ${this.generation} stylesheet */`, {
        headers: { "content-type": "text/css" },
      })
    );
    await precache.put(
      this.config.fontAsset,
      new SyntheticResponse(`/* generation ${this.generation} font asset */`, {
        headers: { "content-type": "font/woff2" },
      })
    );
    await precache.put(
      this.config.sharedAsset,
      new SyntheticResponse("/* shared font asset inter-latin */", {
        headers: { "content-type": "font/woff2" },
      })
    );

    this.state = "installed";
  }

  async activate(caches: MockCacheStorage, container: MockServiceWorkerContainer): Promise<void> {
    this.state = "activating";
    // Serwist precache eviction: older revisions are deleted
    const allCaches = await caches.keys();
    for (const name of allCaches) {
      if (name.startsWith("serwist-precache-") && name !== `serwist-precache-${this.buildRevision}`) {
        await caches.delete(name);
      }
    }

    // Serwist clientsClaim: true
    container.controller = this;
    this.state = "activated";
    container.dispatchControllerChange();
  }

  async handleFetch(
    url: string,
    destination: "document" | "script" | "style" | "font" | "fetch",
    online: boolean,
    caches: MockCacheStorage
  ): Promise<SyntheticResponse> {
    const pathname = new URL(url, "https://deruiter.dev").pathname;

    // Requirement 4: NetworkOnly for telemetry & Sentry
    if (pathname.startsWith("/api/telemetry") || pathname.includes("sentry")) {
      if (!online) {
        throw new TypeError("Failed to fetch (NetworkOnly route offline)");
      }
      return new SyntheticResponse(JSON.stringify({ status: "recorded" }));
    }

    // Requirement 2: Apply Cache-First runtime strategy for 3D model files
    if (pathname.startsWith("/models/") || /\.(?:glb|gltf|obj)$/i.test(pathname)) {
      const modelCache = await caches.open("3d-models-cache");
      const matched = await modelCache.match(pathname);
      if (matched) return matched;
      if (!online) {
        throw new TypeError(`Failed to fetch 3D model offline: ${pathname}`);
      }
      const response = new SyntheticResponse(`/* 3d model buffer for ${pathname} */`, {
        headers: { "content-type": "model/gltf-binary" },
      });
      await modelCache.put(pathname, response);
      return response;
    }

    // Scripts offline rule: (await caches.match(request)) ?? fetch(request)
    if (!online && /^\/_next\/static\/.+\.js$/.test(pathname)) {
      const match = await caches.match(pathname);
      if (match) return match;
      throw new TypeError(`Failed to fetch offline script: ${pathname}`);
    }

    // Document fallback rule
    if (destination === "document") {
      if (!online) {
        // Try precached shell for this specific route
        const precache = await caches.open(`serwist-precache-${this.buildRevision}`);
        const exactMatch = await precache.match(pathname);
        if (exactMatch) return exactMatch;

        // Fallback to /offline document entry when offline and request destination === "document"
        const offlineMatch = await precache.match("/offline");
        if (offlineMatch) return offlineMatch;
        return new SyntheticResponse("Offline Fallback HTML", { status: 503 });
      }

      // Online: return route HTML from server / current generation
      const html = this.config.htmlRoutes[pathname];
      if (html) {
        return new SyntheticResponse(html, { headers: { "content-type": "text/html" } });
      }
    }

    // Check precache for static styles / fonts
    const precache = await caches.open(`serwist-precache-${this.buildRevision}`);
    const precachedAsset = await precache.match(pathname);
    if (precachedAsset) return precachedAsset;

    // General cache match
    const cached = await caches.match(pathname);
    if (cached) return cached;

    if (!online) {
      throw new TypeError(`Network unreachable offline for ${pathname}`);
    }

    return new SyntheticResponse(`/* network response for ${pathname} */`);
  }
}

export class MockServiceWorkerContainer {
  controller: MockSerwistWorker | null = null;
  private listeners: Map<string, Array<() => void>> = new Map();

  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(type, list.filter((l) => l !== listener));
  }

  dispatchControllerChange(): void {
    const handlers = this.listeners.get("controllerchange") ?? [];
    handlers.forEach((h) => h());
  }
}

/**
 * Two-generation isolated browser fixture orchestrator (#3811).
 */
export class TwoGenerationPwaFixture {
  readonly storage: MockStorage;
  readonly caches: MockCacheStorage;
  readonly serviceWorker: MockServiceWorkerContainer;
  readonly auditLog: PwaUpgradeAuditRecord[] = [];

  readonly gen1Config: BuildGenerationConfig = {
    id: "gen-1",
    shellScriptChunk: "/_next/static/chunks/app-shell-gen1.js",
    featureChunk: "/_next/static/chunks/feature-gen1.js",
    stylesheet: "/_next/static/css/theme-gen1.css",
    fontAsset: "/_next/static/media/font-gen1.woff2",
    sharedAsset: "/_next/static/media/inter-latin.woff2",
    htmlRoutes: {
      "/": "<html><head><script src=\"/_next/static/chunks/app-shell-gen1.js\"></script></head><body><h1>Landing Gen1</h1></body></html>",
      "/stack": "<html><head><script src=\"/_next/static/chunks/app-shell-gen1.js\"></script></head><body><h1>Stack Gen1</h1></body></html>",
      "/arcade": "<html><head><script src=\"/_next/static/chunks/app-shell-gen1.js\"></script></head><body><h1>Arcade Gen1</h1></body></html>",
      "/offline": "<html><head><script src=\"/_next/static/chunks/app-shell-gen1.js\"></script></head><body><h1>Offline Shell Gen1</h1></body></html>",
    },
  };

  readonly gen2Config: BuildGenerationConfig = {
    id: "gen-2",
    shellScriptChunk: "/_next/static/chunks/app-shell-gen2.js",
    featureChunk: "/_next/static/chunks/feature-gen2.js",
    stylesheet: "/_next/static/css/theme-gen2.css",
    fontAsset: "/_next/static/media/font-gen2.woff2",
    sharedAsset: "/_next/static/media/inter-latin.woff2",
    htmlRoutes: {
      "/": "<html><head><script src=\"/_next/static/chunks/app-shell-gen2.js\"></script></head><body><h1>Landing Gen2</h1></body></html>",
      "/stack": "<html><head><script src=\"/_next/static/chunks/app-shell-gen2.js\"></script></head><body><h1>Stack Gen2</h1></body></html>",
      "/arcade": "<html><head><script src=\"/_next/static/chunks/app-shell-gen2.js\"></script></head><body><h1>Arcade Gen2</h1></body></html>",
      "/offline": "<html><head><script src=\"/_next/static/chunks/app-shell-gen2.js\"></script></head><body><h1>Offline Shell Gen2</h1></body></html>",
    },
  };

  workerGen1: MockSerwistWorker;
  workerGen2: MockSerwistWorker;
  online = true;

  constructor() {
    this.storage = new MockStorage();
    this.caches = new MockCacheStorage();
    this.serviceWorker = new MockServiceWorkerContainer();
    this.workerGen1 = new MockSerwistWorker(this.gen1Config);
    this.workerGen2 = new MockSerwistWorker(this.gen2Config);
  }

  async setupInitialGeneration(): Promise<void> {
    await this.workerGen1.install(this.caches);
    await this.workerGen1.activate(this.caches, this.serviceWorker);
    this.recordAudit("setup_initial_generation", "/", "gen-1", "navigator.serviceWorker.register(/sw.js)");
  }

  seedArcadeRun<T>(slug: string, snapshot: RunSnapshot<T>): void {
    this.storage.setItem(runSnapshotKey(slug), JSON.stringify(snapshot));
    const stateObj = snapshot.state as Record<string, unknown> | undefined;
    this.recordAudit("seed_arcade_run", "/arcade", "gen-1", "storage.setItem(arcade_run)", {
      arcadeSaveIdentity: {
        slug,
        schema: snapshot.schema,
        score: typeof stateObj?.score === "number" ? stateObj.score : undefined,
        wave: typeof stateObj?.wave === "number" ? stateObj.wave : undefined,
      },
    });
  }

  seedClinicalStudyDraft(study: StudyProtocol, savedAt = new Date().toISOString()): void {
    const envelope = {
      envelopeVersion: STUDY_DRAFT_ENVELOPE_VERSION,
      savedAt,
      study,
    };
    this.storage.setItem(STUDY_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
    this.recordAudit("seed_clinical_draft", "/crf", "gen-1", "storage.setItem(study_draft)", {
      clinicalDraftIdentity: {
        studyId: study.id,
        envelopeVersion: STUDY_DRAFT_ENVELOPE_VERSION,
        formsCount: study.forms.length,
        savedAt,
      },
    });
  }

  suspendActiveSession(onSuspendCb?: () => void): void {
    onSuspendCb?.();
    this.recordAudit(
      "suspend_active_session",
      "/arcade",
      this.serviceWorker.controller?.generation ?? "gen-1",
      "document.visibilitychange:hidden / window.pagehide"
    );
  }

  resumeActiveSession(): void {
    this.recordAudit(
      "resume_active_session",
      "/arcade",
      this.serviceWorker.controller?.generation ?? "gen-1",
      "document.visibilitychange:visible"
    );
  }

  reloadBrowserPage(route: string): void {
    this.recordAudit(
      "reload_browser_page",
      route,
      this.serviceWorker.controller?.generation ?? "gen-2",
      "window.location.reload()"
    );
  }

  async activateNextGeneration(): Promise<void> {
    // Gen 2 installs in background, updates offline-shell-scripts, skips waiting and claims clients
    await this.workerGen2.install(this.caches);
    await this.workerGen2.activate(this.caches, this.serviceWorker);
    this.recordAudit("activate_next_generation", "/arcade", "gen-2", "serviceWorker.skipWaiting / clientsClaim");
  }

  setOnline(online: boolean): void {
    this.online = online;
    this.recordAudit(
      online ? "network_online" : "network_offline",
      "/arcade",
      this.serviceWorker.controller?.generation ?? "gen-1",
      online ? "window.dispatchEvent('online')" : "window.dispatchEvent('offline')"
    );
  }

  recordAudit(
    phase: string,
    route: string,
    servedGen: BuildGenerationId | "offline-fallback" | "unavailable",
    browserCommand = "none",
    extra?: Partial<PwaUpgradeAuditRecord>
  ): void {
    this.auditLog.push({
      timestamp: Date.now(),
      phase,
      browserCommand,
      controllerGeneration: this.serviceWorker.controller?.generation ?? null,
      online: this.online,
      documentRoute: route,
      servedDocumentGeneration: servedGen,
      servedScripts: servedGen === "gen-1" ? [this.gen1Config.shellScriptChunk] : servedGen === "gen-2" ? [this.gen2Config.shellScriptChunk] : [],
      arcadeSaveIdentity: extra?.arcadeSaveIdentity ?? null,
      clinicalDraftIdentity: extra?.clinicalDraftIdentity ?? null,
      recoveryNotice: extra?.recoveryNotice ?? null,
    });
  }
}
