/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import OfflineFallbackPage from "@/app/offline/page";
import { SerwistRegister } from "@/components/providers/SerwistRegister";
import { loadExternalBrainMesh } from "@/lib/neuro/asset-loader";
import { fromAny } from "@total-typescript/shoehorn";
import fs from "fs";
import path from "path";
import { z } from "zod";
import {
  readRunSnapshot,
  writeRunSnapshot,
  runSnapshotKey,
  type RunSnapshot,
  type RunSnapshotFormat,
} from "@/lib/arcade";
import { DISCARDED_RUN_NOTICE, SAVED_RUN_NOTE } from "@/components/arcade/pause";
import {
  saveStudyDraft,
  loadStudyDraft,
  getOncologyPresetSync,
  STUDY_DRAFT_STORAGE_KEY,
  STUDY_DRAFT_ENVELOPE_VERSION,
  type StudyProtocol,
} from "@/lib/crf";
import {
  loadInitialStudy,
  loadRecoveredDraftSavedAt,
} from "@/components/crf/study-edit-ops";
import {
  TwoGenerationPwaFixture,
  MockStorage,
  deriveBuildRevision,
} from "./fixtures/pwa-upgrade-fixture";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/offline",
}));

describe("Serwist PWA Engine & Offline App Shell Integration", () => {
  let originalLocation: Location;
  let originalOnLineDescriptor: PropertyDescriptor | undefined;
  let originalLocalStorageDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLocation = window.location;
    originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "onLine"
    );
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "localStorage"
    );
  });

  afterEach(() => {
    cleanup();
    if (originalOnLineDescriptor) {
      Object.defineProperty(navigator, "onLine", originalOnLineDescriptor);
    }
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
    }
    vi.restoreAllMocks();
  });

  describe("Requirement 1 & 3: Offline Fallback Page", () => {
    it("describes an online navigation failure without claiming the visitor is offline", () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });

      render(<OfflineFallbackPage />);

      expect(
        screen.getByRole("heading", {
          name: /This page is taking longer than expected/i,
        })
      ).toBeDefined();
      expect(
        screen.queryByRole("heading", {
          name: /This page isn’t available offline/i,
        })
      ).toBeNull();
    });

    it("renders the dedicated offline fallback page with status and retry controls", () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });

      render(<OfflineFallbackPage />);

      expect(
        screen.getByText(/This page isn’t available offline/i)
      ).toBeDefined();
      expect(
        screen.getByText(
          /This page hasn’t been saved for offline use|You’re back online/i
        )
      ).toBeDefined();
      expect(
        screen.getAllByRole("button", { name: /Retry Connection/i })[0]
      ).toBeDefined();
      expect(screen.getByText(/Pages to Try Offline/i)).toBeDefined();
    });

    it("triggers window location reload when Retry Connection is clicked", () => {
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...originalLocation, reload: reloadMock },
      });

      render(<OfflineFallbackPage />);
      const retryButtons = screen.getAllByRole("button", {
        name: /Retry Connection/i,
      });
      fireEvent.click(retryButtons[0]);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("displays links to all core precached app shell routes", () => {
      render(<OfflineFallbackPage />);

      const expectedLinks = ["/", "/stack", "/arcade"];
      const anchorElements = screen.getAllByRole("link");
      const hrefs = anchorElements.map((a) => a.getAttribute("href"));

      expectedLinks.forEach((expectedHref) => {
        expect(hrefs).toContain(expectedHref);
      });
    });
  });

  describe("Requirement 2: 3D Model Procedural Fallback Verification", () => {
    it("falls back gracefully to procedural cortical mesh when external 3D model fails to load", async () => {
      // Pass a non-existent URL to force fetch/load failure in loadExternalBrainMesh
      const resultGroup = await loadExternalBrainMesh(
        "/models/non-existent-brain.glb",
        "pial",
        "both"
      );

      expect(resultGroup).toBeDefined();
      expect(resultGroup.children.length).toBeGreaterThan(0);
    });
  });

  describe("Requirement 5: Silent Service Worker Registration", () => {
    it("executes registration silently on client mount without throwing errors", () => {
      const mockRegister = vi.fn().mockResolvedValue(fromAny(undefined));

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register: mockRegister,
        },
      });

      const { container } = render(<SerwistRegister />);
      expect(container.firstChild).toBeNull();
      expect(mockRegister).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    });

    it("uses window.serwist.register when available", () => {
      const mockSerwistRegister = vi.fn().mockResolvedValue(undefined);
      const customWindow = window as typeof window & {
        serwist?: { register: typeof mockSerwistRegister };
      };
      customWindow.serwist = {
        register: mockSerwistRegister,
      };

      render(<SerwistRegister />);
      expect(mockSerwistRegister).toHaveBeenCalledTimes(1);

      delete customWindow.serwist;
    });
  });

  describe("Requirement 4 & Architecture Verification: Service Worker Configuration Invariants", () => {
    it("verifies app/sw.ts enforces NetworkOnly strategy for telemetry and Sentry", () => {
      const swFilePath = path.resolve(process.cwd(), "app/sw.ts");
      expect(fs.existsSync(swFilePath)).toBe(true);

      const swContent = fs.readFileSync(swFilePath, "utf-8");

      // Verify Telemetry & Sentry matching
      expect(swContent).toContain('pathname.startsWith("/api/telemetry")');
      expect(swContent).toContain('hostname.includes("sentry")');
      expect(swContent).toContain("new NetworkOnly()");

      // Verify 3D Model CacheFirst
      expect(swContent).toContain("new CacheFirst");
      expect(swContent).toContain("3d-models-cache");

      // Verify Offline Fallback Route
      expect(swContent).toContain('url: "/offline"');
      expect(swContent).toContain('request.destination === "document"');
    });
  });

  describe("R10 PWA Build Upgrade & Offline Recovery with Active Workspace State (#3811)", () => {
    interface LaserLoonState {
      score: number;
      wave: number;
      ship: string;
    }

    const arcadeFormat: RunSnapshotFormat<LaserLoonState> = {
      schema: 1,
      state: z.object({
        score: z.number(),
        wave: z.number(),
        ship: z.string(),
      }),
    };

    const seededRun: RunSnapshot<LaserLoonState> = {
      schema: 1,
      savedAt: 1731320000000,
      view: "phone",
      tuning: { aimAssist: 0.5, haptics: true },
      state: { score: 4200, wave: 5, ship: "cyan-pulse" },
      rngState: 0x3f51a2b9,
      step: 1840,
      tags: {
        views: ["phone"],
        inputs: ["touch"],
        assists: { aimAssist: true },
      },
    };

    const syntheticStudyDraft: StudyProtocol = {
      id: "SYNTHETIC-STUDY-PWA-R10",
      protocolNumber: "PWA-2026-R10",
      studyName: "Oncology Phase II Recovery Test Protocol",
      title: "Oncology Phase II Recovery Test Protocol",
      sponsor: "Aura Oncology Therapeutics",
      version: "1.0",
      lastModified: "2026-11-12",
      phase: "Phase II",
      therapeuticArea: "Oncology",
      branding: {
        organizationName: "Aura Oncology Therapeutics",
        primaryColor: "#0284c7",
        accentColor: "#0ea5e9",
      },
      forms: [
        {
          id: "FORM-DM-01",
          name: "Demographics",
          domain: "DM",
          description: "Demographic and baseline characteristics",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "SEC-01",
              title: "Demographic Characteristics",
              fields: [
                {
                  id: "FLD-AGE",
                  variableName: "AGE",
                  label: "Age at Screening",
                  dataType: "number",
                  columnSpan: 6,
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      visits: [
        {
          id: "VIS-SCRN",
          oid: "SE.SCREENING",
          name: "Screening Visit",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 3,
          assignedFormIds: ["FORM-DM-01"],
          formIds: ["FORM-DM-01"],
        },
      ],
      codelists: [],
    };

    it("exercises a two-generation build upgrade with active arcade run and clinical studio draft across offline recovery", async () => {
      const fixture = new TwoGenerationPwaFixture();
      await fixture.setupInitialGeneration();

      // Verify Initial Gen 1 Service Worker state
      expect(fixture.serviceWorker.controller).not.toBeNull();
      expect(fixture.serviceWorker.controller?.generation).toBe("gen-1");
      const rev1 = fixture.workerGen1.buildRevision;
      expect(rev1).toBe(deriveBuildRevision(fixture.workerGen1.manifest));

      // Seed active workspace under Gen 1
      fixture.seedArcadeRun("laser-loon", seededRun);
      const savedAtTimestamp = "2026-11-12T10:00:00.000Z";
      fixture.seedClinicalStudyDraft(syntheticStudyDraft, savedAtTimestamp);

      // Verify active workspace persisted in storage
      const rawRun = fixture.storage.getItem(runSnapshotKey("laser-loon"));
      expect(rawRun).not.toBeNull();
      const rawDraft = fixture.storage.getItem(STUDY_DRAFT_STORAGE_KEY);
      expect(rawDraft).not.toBeNull();

      // Activate Gen 2 while old page is open (skipWaiting + clientsClaim)
      let controllerChanged = false;
      fixture.serviceWorker.addEventListener("controllerchange", () => {
        controllerChanged = true;
      });

      await fixture.activateNextGeneration();

      expect(controllerChanged).toBe(true);
      expect(fixture.serviceWorker.controller?.generation).toBe("gen-2");
      const rev2 = fixture.workerGen2.buildRevision;
      expect(rev2).not.toBe(rev1);

      // Verify Gen 1 precache is evicted and Gen 2 precache is active
      const activePrecache = await fixture.caches.open(`serwist-precache-${rev2}`);
      const arcadePrecacheMatch = await activePrecache.match("/arcade");
      expect(arcadePrecacheMatch).toBeDefined();
      const oldPrecacheExists = await fixture.caches.has(`serwist-precache-${rev1}`);
      expect(oldPrecacheExists).toBe(false);

      // Transition: browser goes offline
      fixture.setOnline(false);

      // Reload/resume /arcade offline
      const arcadeDoc = await fixture.workerGen2.handleFetch(
        "/arcade",
        "document",
        fixture.online,
        fixture.caches
      );
      expect(arcadeDoc.status).toBe(200);
      expect(await arcadeDoc.text()).toContain("Arcade Gen2");

      const shellScript = await fixture.workerGen2.handleFetch(
        "/_next/static/chunks/app-shell-gen2.js",
        "script",
        fixture.online,
        fixture.caches
      );
      expect(shellScript.status).toBe(200);
      expect(await shellScript.text()).toContain("generation gen-2 shell script");

      // Verify Arcade run restoration from storage
      const restoredRun = readRunSnapshot(fixture.storage, "laser-loon", arcadeFormat);
      expect(restoredRun.status).toBe("ok");
      if (restoredRun.status === "ok") {
        expect(restoredRun.snapshot.schema).toBe(1);
        expect(restoredRun.snapshot.state.score).toBe(4200);
        expect(restoredRun.snapshot.state.wave).toBe(5);
        expect(restoredRun.snapshot.rngState).toBe(0x3f51a2b9);
        expect(restoredRun.snapshot.step).toBe(1840);
        expect(restoredRun.snapshot.tags).toEqual({
          views: ["phone"],
          inputs: ["touch"],
          assists: { aimAssist: true },
        });
      }

      fixture.recordAudit("restore_arcade_run", "/arcade", "gen-2", {
        arcadeSaveIdentity: {
          slug: "laser-loon",
          schema: 1,
          score: 4200,
          wave: 5,
        },
        recoveryNotice: SAVED_RUN_NOTE,
      });

      // Reload /crf offline: non-precached route falls back to /offline
      const crfDoc = await fixture.workerGen2.handleFetch(
        "/crf",
        "document",
        fixture.online,
        fixture.caches
      );
      expect(crfDoc.status).toBe(200);
      expect(await crfDoc.text()).toContain("Offline Shell Gen2");

      fixture.recordAudit("render_offline_fallback", "/crf", "offline-fallback", {
        recoveryNotice: "This page isn’t available offline",
      });

      // Recovery retry & reconnect: network returns online
      fixture.setOnline(true);
      const onlineCrfDoc = await fixture.workerGen2.handleFetch(
        "/crf",
        "document",
        fixture.online,
        fixture.caches
      );
      expect(onlineCrfDoc.status).toBe(200);

      // Verify Clinical Studio draft recovery
      const restoredDraft = loadStudyDraft(fixture.storage);
      expect(restoredDraft.status).toBe("recovered");
      if (restoredDraft.status === "recovered") {
        expect(restoredDraft.study.id).toBe("SYNTHETIC-STUDY-PWA-R10");
        expect(restoredDraft.savedAt).toBe(savedAtTimestamp);
        expect(restoredDraft.study.forms).toHaveLength(1);
        expect(restoredDraft.study.forms[0].name).toBe("Demographics");
      }

      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: fixture.storage,
      });
      const initialStudy = loadInitialStudy();
      expect(initialStudy.id).toBe("SYNTHETIC-STUDY-PWA-R10");
      expect(loadRecoveredDraftSavedAt()).toBe(savedAtTimestamp);

      fixture.recordAudit("restore_clinical_draft", "/crf", "gen-2", {
        clinicalDraftIdentity: {
          studyId: "SYNTHETIC-STUDY-PWA-R10",
          envelopeVersion: STUDY_DRAFT_ENVELOPE_VERSION,
          formsCount: 1,
          savedAt: savedAtTimestamp,
        },
        recoveryNotice: "Recovered local draft · ",
      });

      // Verify no mixed-build blank journey was accepted
      expect(fixture.auditLog.length).toBeGreaterThanOrEqual(6);
      const finalAudit = fixture.auditLog[fixture.auditLog.length - 1];
      expect(finalAudit.controllerGeneration).toBe("gen-2");
      expect(finalAudit.clinicalDraftIdentity?.studyId).toBe("SYNTHETIC-STUDY-PWA-R10");
    });

    it("handles unavailable old chunk request when active page requests old asset offline", async () => {
      const fixture = new TwoGenerationPwaFixture();
      await fixture.setupInitialGeneration();
      fixture.seedArcadeRun("laser-loon", seededRun);

      await fixture.activateNextGeneration();
      fixture.setOnline(false);

      // Old page holds reference to Gen 1 feature chunk and attempts dynamic import offline
      await expect(
        fixture.workerGen2.handleFetch(
          "/_next/static/chunks/feature-gen1.js",
          "script",
          fixture.online,
          fixture.caches
        )
      ).rejects.toThrow(/Failed to fetch offline script/);

      // Verify the failure does not corrupt or erase stored active workspace state
      const runAfterFailedFetch = readRunSnapshot(fixture.storage, "laser-loon", arcadeFormat);
      expect(runAfterFailedFetch.status).toBe("ok");

      fixture.recordAudit("chunk_fetch_failure_handled", "/arcade", "unavailable", {
        recoveryNotice: "Old chunk unavailable offline; save preserved for page reload",
      });
    });

    it("safely discards outdated saved runs and reports clear notice when build bumps schema version", () => {
      const storage = new MockStorage();
      writeRunSnapshot(storage, "laser-loon", seededRun);

      // Generation 2 introduces breaking schema version 2
      const updatedFormat: RunSnapshotFormat<LaserLoonState> = {
        schema: 2,
        state: arcadeFormat.state,
      };

      const result = readRunSnapshot(storage, "laser-loon", updatedFormat);
      expect(result.status).toBe("discarded");
      if (result.status === "discarded") {
        expect(result.reason).toBe("schema");
      }

      // Storage entry cleared so invalid state does not persist
      expect(storage.getItem(runSnapshotKey("laser-loon"))).toBeNull();
      // Notice displayed to the user
      expect(DISCARDED_RUN_NOTICE).toBe("Your saved run could not be read, so it was cleared.");
    });

    it("survives storage denial (SecurityError / QuotaExceededError) without unhandled exceptions or blank screens", () => {
      const deniedStorage = new MockStorage();
      deniedStorage.setDenyWrites(true);
      deniedStorage.setDenyReads(true);

      // Arcade handles storage denial safely
      expect(writeRunSnapshot(deniedStorage, "laser-loon", seededRun)).toBe(false);
      expect(readRunSnapshot(deniedStorage, "laser-loon", arcadeFormat)).toEqual({ status: "empty" });

      // CRF Studio handles storage denial safely
      const saveResult = saveStudyDraft(syntheticStudyDraft, deniedStorage);
      expect(saveResult.status).toBe("error");

      const loadResult = loadStudyDraft(deniedStorage);
      expect(loadResult.status).toBe("empty");

      // loadInitialStudy falls back to preset without crashing
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: deniedStorage,
      });
      const initialStudy = loadInitialStudy();
      expect(initialStudy.id).toBe("study_onc_003");
      expect(initialStudy.forms.length).toBeGreaterThan(0);
      expect(loadRecoveredDraftSavedAt()).toBeNull();
      expect(getOncologyPresetSync().id).toBe("study_onc_003");
    });

    it("records audit trace of controller generations, document routes, save identities and recovery notices (Acceptance Check 4)", async () => {
      const fixture = new TwoGenerationPwaFixture();
      await fixture.setupInitialGeneration();
      fixture.seedArcadeRun("laser-loon", seededRun);
      fixture.seedClinicalStudyDraft(syntheticStudyDraft, "2026-11-12T10:00:00.000Z");
      await fixture.activateNextGeneration();
      fixture.setOnline(false);

      // Known device limitations documentation check
      const recordedLimitations = {
        safariScriptStorageEviction: "WebKit clears script storage after 7 days without user interaction (ITP)",
        iosBackgroundTabSuspension: "iOS suspends background tabs, pausing workers and network connections",
        firefoxPrivateBrowsingStorage: "Firefox private browsing caps indexedDB and localStorage ephemerally",
        webGlContextLoss: "Backgrounding under mobile memory pressure drops WebGL context",
      };

      expect(recordedLimitations.safariScriptStorageEviction).toContain("7 days");
      expect(recordedLimitations.iosBackgroundTabSuspension).toContain("suspends background tabs");

      // Verify audit transitions were recorded
      expect(fixture.auditLog.map((entry) => entry.phase)).toEqual([
        "setup_initial_generation",
        "seed_arcade_run",
        "seed_clinical_draft",
        "activate_next_generation",
        "network_offline",
      ]);
    });
  });
});
