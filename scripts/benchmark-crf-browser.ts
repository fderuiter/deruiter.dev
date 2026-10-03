/**
 * Browser phase of the CRF workload benchmark (#682): drives the real /crf
 * page of a production build in headless Chromium with each synthetic study
 * and records latency, main-thread responsiveness, heap and failure/recovery
 * behaviour per workflow. Invoked by scripts/benchmark-crf.ts.
 */

import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type {
  Browser,
  BrowserContext,
  CDPSession,
  Page,
} from "@playwright/test";
import { launchChromiumWithFallback } from "../lib/dx/browser-launch";
import {
  amendCrfWorkload,
  generateCrfWorkload,
  type CrfWorkloadId,
} from "../lib/dx/crf-workloads";
import {
  StudyProtocolEngine,
  STUDY_BASELINES_STORAGE_KEY,
  STUDY_DRAFT_ENVELOPE_VERSION,
  STUDY_DRAFT_STORAGE_KEY,
  compareStudyToBaseline,
  exportStudyToCdiscOdmXml,
  exportUniversalCrfJson,
  saveStudyBaseline,
  type StudyProtocol,
} from "../lib/crf";
import {
  summarizeTimings,
  type CrfBenchmarkOptions,
  type StepResult,
  type StepStatus,
} from "./benchmark-crf-shared";

/** Main-thread responsiveness observed while one step ran. */
interface Responsiveness {
  longTasks: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  /** Longest Event Timing entry (input delay + processing + next paint), an INP proxy. */
  maxEventMs: number | null;
}

interface BrowserStepResult extends StepResult {
  responsiveness?: Responsiveness;
}

interface HeapSample {
  label: string;
  jsHeapUsedBytes: number;
  domNodes: number;
}

interface WorkloadBrowserResult {
  workload: CrfWorkloadId;
  /** Sessions merged into this result. */
  runs?: number;
  draftBytes: number;
  baselineBytes: number;
  nativeFileBytes: number;
  steps: BrowserStepResult[];
  heap: HeapSample[];
  pageErrors: string[];
  crashed: boolean;
}

export interface BrowserPhaseResult {
  status: StepStatus;
  reason?: string;
  baseUrl: string;
  serverOwned: boolean;
  chromium: string | null;
  playwright: string | null;
  viewport: { width: number; height: number };
  localStorageCapacityChars: number | null;
  /** The same input sequences on a trivial page: the automation's own cost. */
  automationOverheadMs: Record<string, number> | null;
  workloads: WorkloadBrowserResult[];
}

const VIEWPORT = { width: 1440, height: 900 };

const INSTRUMENTATION = `
(() => {
  // tsx compiles page.evaluate callbacks with esbuild's keepNames helper.
  window.__name = window.__name || ((fn) => fn);
  const bench = { longtasks: [], events: [] };
  window.__crfBench = bench;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) bench.longtasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) bench.events.push({ name: entry.name, start: entry.startTime, duration: entry.duration });
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  } catch {}
})();
`;

function readPlaywrightVersion(): string | null {
  try {
    const file = path.join(
      process.cwd(),
      "node_modules",
      "@playwright",
      "test",
      "package.json"
    );
    return (JSON.parse(fs.readFileSync(file, "utf-8")) as { version: string })
      .version;
  } catch {
    return null;
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function startServer(port: number): ChildProcess {
  const nextBin = path.join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );
  return spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://dummy:dummy@127.0.0.1:59999/dummy",
    },
    stdio: "ignore",
  });
}

async function responsivenessSince(
  page: Page,
  since: number
): Promise<Responsiveness> {
  return page.evaluate((start) => {
    const bench = (
      window as unknown as {
        __crfBench?: {
          longtasks: { start: number; duration: number }[];
          events: { start: number; duration: number }[];
        };
      }
    ).__crfBench;
    const tasks = (bench?.longtasks || []).filter(
      (task) => task.start >= start
    );
    const events = (bench?.events || []).filter(
      (event) => event.start >= start
    );
    return {
      longTasks: tasks.length,
      longTaskTotalMs: Math.round(
        tasks.reduce((total, task) => total + task.duration, 0)
      ),
      longTaskMaxMs: Math.round(
        tasks.reduce((max, task) => Math.max(max, task.duration), 0)
      ),
      maxEventMs: events.length
        ? Math.round(Math.max(...events.map((event) => event.duration)))
        : null,
    };
  }, since);
}

async function now(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

async function sampleHeap(
  session: CDPSession,
  label: string
): Promise<HeapSample> {
  await session.send("HeapProfiler.collectGarbage");
  const { metrics } = (await session.send("Performance.getMetrics")) as {
    metrics: { name: string; value: number }[];
  };
  const value = (name: string) =>
    metrics.find((metric) => metric.name === name)?.value ?? 0;
  return {
    label,
    jsHeapUsedBytes: value("JSHeapUsedSize"),
    domNodes: value("Nodes"),
  };
}

function stepFailure(
  workflow: string,
  step: string,
  error: unknown
): BrowserStepResult {
  const message =
    error instanceof Error ? error.message.split("\n")[0] : String(error);
  return { workflow, step, status: "failed", reason: message };
}

function skipped(
  workflow: string,
  step: string,
  reason: string
): BrowserStepResult {
  return { workflow, step, status: "skipped", reason };
}

/**
 * Runs `action`, which must resolve with the in-page performance.now() at
 * which the step's visible result appeared, and records the in-page latency
 * plus the long tasks and slow events that occurred meanwhile.
 */
async function timedStep(
  page: Page,
  workflow: string,
  step: string,
  action: () => Promise<{
    doneAt: number;
    startedAt?: number;
    facts?: StepResult["facts"];
    status?: StepStatus;
    reason?: string;
  }>
): Promise<BrowserStepResult> {
  try {
    const initial = await now(page);
    const outcome = await action();
    const started = outcome.startedAt ?? initial;
    const latency = outcome.doneAt - started;
    return {
      workflow,
      step,
      status: outcome.status || "passed",
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      timing: {
        median: Number(latency.toFixed(1)),
        p95: Number(latency.toFixed(1)),
        min: Number(latency.toFixed(1)),
        max: Number(latency.toFixed(1)),
        samples: [Number(latency.toFixed(1))],
      },
      ...(outcome.facts ? { facts: outcome.facts } : {}),
      responsiveness: await responsivenessSince(page, started),
    };
  } catch (error) {
    const debugDirectory = process.env.CRF_BENCH_DEBUG_DIR;
    if (debugDirectory) {
      fs.mkdirSync(debugDirectory, { recursive: true });
      const name = `${workflow}-${step}`
        .replace(/[^a-z0-9]+/gi, "-")
        .slice(0, 80);
      await page
        .screenshot({
          path: path.join(debugDirectory, `${name}-${Date.now()}.png`),
        })
        .catch(() => undefined);
    }
    return stepFailure(workflow, step, error);
  }
}

/** Resolves with performance.now() at the first animation frame where `predicate` holds. */
async function frameWhen(
  page: Page,
  predicate: string,
  arg: unknown,
  timeout: number
): Promise<number> {
  const handle = await page.waitForFunction(
    // eslint-disable-next-line no-new-func
    new Function(
      "arg",
      `return (${predicate})(arg) ? performance.now() : false;`
    ) as (arg: unknown) => number | false,
    arg,
    { polling: "raf", timeout }
  );
  return (await handle.jsonValue()) as number;
}

function buildSeeds(id: CrfWorkloadId) {
  const pristine = generateCrfWorkload(id);
  const amendCount = Math.min(10, pristine.forms.length);
  const { study: draft } = amendCrfWorkload(pristine, amendCount);
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  const saved = saveStudyBaseline(
    pristine,
    {
      versionTag: "v1.0",
      label: "Pristine workload",
      actor: { name: "Benchmark" },
    },
    storage
  );
  if (saved.status !== "saved")
    throw new Error(`could not build baseline seed: ${saved.status}`);
  const baselineRaw = memory.get(STUDY_BASELINES_STORAGE_KEY) as string;
  const draftRaw = JSON.stringify({
    envelopeVersion: STUDY_DRAFT_ENVELOPE_VERSION,
    savedAt: "2026-01-01T00:00:00.000Z",
    study: draft,
  });
  return {
    pristine,
    draft,
    amendCount,
    baselineId: saved.baseline.id,
    baselineRaw,
    draftRaw,
    nativeFile: exportUniversalCrfJson(draft),
  };
}

/** Diff count the UI should show after the benchmark's two label edits on form 1. */
function expectedDiffCount(
  pristine: StudyProtocol,
  draft: StudyProtocol,
  edits: { fieldId: string; label: string }[]
): number {
  let study = draft;
  const form = draft.forms[0];
  for (const edit of edits)
    study = StudyProtocolEngine.updateField(study, form.id, edit.fieldId, {
      label: edit.label,
    }).study;
  return compareStudyToBaseline(study, pristine, {
    id: "x",
    versionTag: "v1.0",
    label: "x",
  }).summary.totalChanges;
}

function single(value: number) {
  const rounded = Number(value.toFixed(1));
  return {
    median: rounded,
    p95: rounded,
    min: rounded,
    max: rounded,
    samples: [rounded],
  };
}

/**
 * Resolves with the end of the last long task once the main thread has had
 * no long task for one second after `readyAt`: the point at which the page
 * stops being busy, not just the point at which content appears.
 */
async function mainThreadSettled(
  page: Page,
  readyAt: number,
  timeout: number
): Promise<number> {
  const handle = await page.waitForFunction(
    (since) => {
      const bench = (
        window as unknown as {
          __crfBench?: { longtasks: { start: number; duration: number }[] };
        }
      ).__crfBench;
      const lastEnd = (bench?.longtasks || []).reduce(
        (latest, task) => Math.max(latest, task.start + task.duration),
        since
      );
      return performance.now() - lastEnd >= 1000 ? lastEnd : false;
    },
    readyAt,
    { polling: 100, timeout }
  );
  return (await handle.jsonValue()) as number;
}

async function studioReady(
  page: Page,
  formName: string,
  timeout: number,
  requireRecovered: boolean
): Promise<number> {
  return frameWhen(
    page,
    `(arg) => {
      const spine = document.querySelector('[data-testid="study-spine-root"]');
      if (!spine || !spine.textContent.includes(arg.formName)) return false;
      if (!arg.requireRecovered) return true;
      const status = document.querySelector('[data-testid="draft-save-status"]');
      return Boolean(status && status.textContent.includes('Recovered local draft'));
    }`,
    { formName, requireRecovered },
    timeout
  );
}

async function runWorkload(
  browser: Browser,
  baseUrl: string,
  id: CrfWorkloadId,
  options: CrfBenchmarkOptions
): Promise<WorkloadBrowserResult> {
  const seeds = buildSeeds(id);
  const timeout = options.stepTimeoutMs;
  const result: WorkloadBrowserResult = {
    workload: id,
    draftBytes: Buffer.byteLength(seeds.draftRaw),
    baselineBytes: Buffer.byteLength(seeds.baselineRaw),
    nativeFileBytes: Buffer.byteLength(seeds.nativeFile),
    steps: [],
    heap: [],
    pageErrors: [],
    crashed: false,
  };
  const context: BrowserContext = await browser.newContext({
    viewport: VIEWPORT,
    acceptDownloads: true,
  });
  await context.addInitScript(INSTRUMENTATION);
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    if (result.pageErrors.length < 10)
      result.pageErrors.push(error.message.split("\n")[0]);
  });
  page.on("crash", () => {
    result.crashed = true;
  });
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  const firstForm = seeds.draft.forms[0];
  const firstFields = firstForm.sections.flatMap((section) => section.fields);
  const designerField = firstFields[6];
  const gridField = firstFields[1];
  const designerLabel = `${designerField.label} edited`;
  const gridLabel = "Grid edit";

  try {
    await page.goto(`${baseUrl}/crf`, { waitUntil: "load", timeout });
    await page.waitForSelector('[data-testid="study-spine-root"]', { timeout });

    // --- Seed local storage as an author's previous session would have left it.
    const seed = await page.evaluate(
      ({ draftKey, draft, baselineKey, baselines }) => {
        const attempt = (key: string, value: string) => {
          try {
            localStorage.setItem(key, value);
            return "stored";
          } catch (error) {
            return `${(error as Error).name}: ${(error as Error).message}`;
          }
        };
        return {
          baseline: attempt(baselineKey, baselines),
          draft: attempt(draftKey, draft),
        };
      },
      {
        draftKey: STUDY_DRAFT_STORAGE_KEY,
        draft: seeds.draftRaw,
        baselineKey: STUDY_BASELINES_STORAGE_KEY,
        baselines: seeds.baselineRaw,
      }
    );
    const draftStored = seed.draft === "stored";
    const baselineStored = seed.baseline === "stored";
    result.steps.push({
      workflow: "save-reopen",
      step: "local draft + baseline fit in localStorage",
      status: draftStored && baselineStored ? "passed" : "failed",
      facts: {
        draft: seed.draft,
        baseline: seed.baseline,
        draftKiB: Math.round(result.draftBytes / 1024),
        baselineKiB: Math.round(result.baselineBytes / 1024),
      },
      ...(draftStored && baselineStored
        ? {}
        : { reason: `draft: ${seed.draft}; baseline: ${seed.baseline}` }),
    });

    // --- Reopen from the local draft.
    let studyLoaded = false;
    if (draftStored) {
      try {
        await page.reload({ waitUntil: "commit", timeout });
        const readyAt = await studioReady(page, firstForm.name, timeout, true);
        const settledAt = await mainThreadSettled(page, readyAt, timeout);
        const dom = await page.evaluate(() => ({
          domNodes: document.getElementsByTagName("*").length,
          spineDomNodes: Array.from(
            document.querySelectorAll('[data-testid="study-spine-root"]')
          ).reduce(
            (total, root) => total + root.getElementsByTagName("*").length,
            0
          ),
          fieldCardsMounted:
            document.querySelectorAll("[data-field-id]").length,
        }));
        result.steps.push({
          workflow: "save-reopen",
          step: "reopen from local draft (navigation start to studio ready)",
          status: "passed",
          timing: single(readyAt),
          responsiveness: await responsivenessSince(page, 0),
          facts: dom,
        });
        result.steps.push({
          workflow: "save-reopen",
          step: "reopen from local draft (navigation start to main thread quiet for 1 s)",
          status: "passed",
          timing: single(settledAt),
          responsiveness: await responsivenessSince(page, 0),
        });
        studyLoaded = true;
      } catch (error) {
        result.steps.push(
          stepFailure(
            "save-reopen",
            "reopen from local draft (navigation start to studio ready)",
            error
          )
        );
      }
    } else {
      result.steps.push(
        skipped(
          "save-reopen",
          "reopen from local draft (navigation start to studio ready)",
          "draft could not be stored"
        )
      );
    }
    if (studyLoaded)
      result.heap.push(await sampleHeap(session, "after reopen"));
    if (!studyLoaded) {
      for (const [workflow, step] of [
        [
          "save-reopen",
          "reopen from local draft (navigation start to main thread quiet for 1 s)",
        ],
        ["edit", "select field (canvas click to inspector)"],
        ["edit", "type 7 characters into label"],
        ["save-reopen", "autosave after edit"],
        ["save-reopen", "edit survives reload"],
        ["grid", "open Form Grid"],
        ["grid", "commit one cell edit"],
        ["grid", "ArrowDown x10"],
        ["scenario", "open Form Test dock"],
        ["scenario", "Fill sample (runs form test)"],
        ["baseline", "open comparison"],
        ["export", "open Exports (Universal JSON preview)"],
        ["export", "switch to ODM-XML preview"],
        ["export", "download ODM-XML"],
        ["export", "annotated Word (.docx), all forms (click to download)"],
        ["export", "annotated PDF (.pdf), all forms (click to download)"],
        [
          "baseline",
          "baseline snapshots that fit beside the draft (studio allows 50)",
        ],
      ])
        result.steps.push(
          skipped(
            workflow,
            step,
            "study could not be reopened from the local draft"
          )
        );
    } else {
      // --- Edit in the designer.
      // The canvas is mounted twice (desktop and a hidden narrow layout), so
      // only the visible copy is interacted with.
      const fieldGroup = page
        .locator(`[data-field-id="${designerField.id}"]:visible`)
        .first();
      const labelInput = page
        .locator('label:has-text("Question Text / Form Label") + input:visible')
        .first();
      result.steps.push(
        await timedStep(
          page,
          "edit",
          "select field (canvas click to inspector)",
          async () => {
            await fieldGroup.scrollIntoViewIfNeeded({ timeout });
            await fieldGroup.click({ timeout });
            await labelInput.waitFor({ state: "visible", timeout });
            return { doneAt: await now(page) };
          }
        )
      );
      result.steps.push(
        await timedStep(
          page,
          "edit",
          "type 7 characters into label",
          async () => {
            await labelInput.click({ timeout });
            await page.keyboard.press("End");
            await page.keyboard.type(" edited");
            const doneAt = await frameWhen(
              page,
              `(arg) => Boolean(document.querySelector('[aria-label="Field ' + arg.variable + ': ' + arg.label + '"]'))`,
              { variable: designerField.variableName, label: designerLabel },
              timeout
            );
            return { doneAt };
          }
        )
      );
      result.steps.push(
        await timedStep(
          page,
          "save-reopen",
          "autosave after edit",
          async () => {
            const doneAt = await frameWhen(
              page,
              `() => { const s = document.querySelector('[data-testid="draft-save-status"]'); return Boolean(s && /Saved locally|Local save failed/.test(s.textContent)); }`,
              null,
              timeout
            );
            const state = await page.evaluate((key) => {
              const status =
                document.querySelector('[data-testid="draft-save-status"]')
                  ?.textContent || "";
              const raw = localStorage.getItem(key) || "";
              return { status, persisted: raw.includes(" edited") };
            }, STUDY_DRAFT_STORAGE_KEY);
            const failed = /Local save failed/.test(state.status);
            return {
              doneAt,
              facts: {
                status: state.status.trim(),
                editPersisted: state.persisted,
                debounceMs: 800,
              },
              ...(failed || !state.persisted
                ? {
                    status: "failed" as const,
                    reason:
                      state.status.trim() || "edit not found in stored draft",
                  }
                : {}),
            };
          }
        )
      );
      try {
        await page.reload({ waitUntil: "commit", timeout });
        const readyAt = await studioReady(page, firstForm.name, timeout, true);
        const survived = await page
          .locator(
            `[aria-label="Field ${designerField.variableName}: ${designerLabel}"]`
          )
          .count();
        result.steps.push({
          workflow: "save-reopen",
          step: "edit survives reload",
          status: survived > 0 ? "passed" : "failed",
          timing: single(readyAt),
          facts: { editedFieldFound: survived > 0 },
          responsiveness: await responsivenessSince(page, 0),
          ...(survived > 0
            ? {}
            : { reason: "edited label absent after reload" }),
        });
      } catch (error) {
        result.steps.push(
          stepFailure("save-reopen", "edit survives reload", error)
        );
      }

      // --- Form Grid.
      const rowCount = firstFields.length;
      result.steps.push(
        await timedStep(page, "grid", "open Form Grid", async () => {
          await page
            .getByRole("tab", { name: /Form Grid/ })
            .first()
            .click({ timeout });
          const doneAt = await frameWhen(
            page,
            `(arg) => document.querySelectorAll('[aria-label="Active Form Grid"] table tbody tr').length === arg`,
            rowCount,
            timeout
          );
          return { doneAt, facts: { rows: rowCount } };
        })
      );
      const labelCell = page
        .locator('[aria-label="Active Form Grid"] table tbody tr')
        .nth(1)
        .locator("td")
        .nth(3);
      result.steps.push(
        await timedStep(page, "grid", "commit one cell edit", async () => {
          await labelCell.click({ timeout });
          await page.keyboard.press("Enter");
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.type(gridLabel);
          await page.keyboard.press("Enter");
          const doneAt = await frameWhen(
            page,
            `(arg) => { const row = document.querySelectorAll('[aria-label="Active Form Grid"] table tbody tr')[1]; return Boolean(row && row.querySelectorAll('td')[3] && row.querySelectorAll('td')[3].textContent.trim() === arg); }`,
            gridLabel,
            timeout
          );
          return { doneAt };
        })
      );
      result.steps.push(
        await timedStep(page, "grid", "ArrowDown x10", async () => {
          await page.keyboard.press("Escape");
          await labelCell.click({ timeout });
          for (let press = 0; press < 10; press++)
            await page.keyboard.press("ArrowDown");
          const target = Math.min(rowCount - 1, 11);
          const doneAt = await frameWhen(
            page,
            `(arg) => { const row = document.querySelectorAll('[aria-label="Active Form Grid"] table tbody tr')[arg]; return Boolean(row && row.querySelector('td.ring-2')); }`,
            target,
            timeout
          );
          return { doneAt };
        })
      );
      result.heap.push(await sampleHeap(session, "after grid"));

      // --- Form test dock (scenario run on the active form).
      const dock = page.getByRole("region", { name: "Form test dock" });
      result.steps.push(
        await timedStep(page, "scenario", "open Form Test dock", async () => {
          await page
            .locator("button[aria-pressed]", { hasText: "Test" })
            .first()
            .click({ timeout });
          await dock.waitFor({ state: "visible", timeout });
          return { doneAt: await now(page) };
        })
      );
      result.steps.push(
        await timedStep(
          page,
          "scenario",
          "Fill sample (runs form test)",
          async () => {
            const before = (await dock.textContent({ timeout })) || "";
            await dock
              .getByRole("button", { name: /Fill sample/ })
              .click({ timeout });
            const doneAt = await frameWhen(
              page,
              `(arg) => { const d = document.querySelector('[aria-label="Form test dock"]'); return Boolean(d && d.textContent !== arg); }`,
              before,
              timeout
            );
            return { doneAt };
          }
        )
      );
      await page
        .getByRole("button", { name: "Close form test dock" })
        .click({ timeout })
        .catch(() => undefined);

      // --- Baseline comparison.
      if (baselineStored) {
        // Only the edits that the earlier steps actually applied are expected.
        const applied = (workflow: string, step: string) =>
          result.steps.some(
            (candidate) =>
              candidate.workflow === workflow &&
              candidate.step === step &&
              candidate.status === "passed"
          );
        const edits = [
          ...(applied("edit", "type 7 characters into label")
            ? [{ fieldId: designerField.id, label: designerLabel }]
            : []),
          ...(applied("grid", "commit one cell edit")
            ? [{ fieldId: gridField.id, label: gridLabel }]
            : []),
        ];
        const expected = expectedDiffCount(seeds.pristine, seeds.draft, edits);
        result.steps.push(
          await timedStep(page, "baseline", "open comparison", async () => {
            await page.evaluate((baselineId) => {
              window.location.hash = `compare=${baselineId}`;
            }, seeds.baselineId);
            const doneAt = await frameWhen(
              page,
              `() => Array.from(document.querySelectorAll('button')).some((b) => /^All \\(\\d+\\)$/.test(b.textContent.trim()))`,
              null,
              timeout
            );
            const shown = await page.evaluate(() => {
              const button = Array.from(
                document.querySelectorAll("button")
              ).find((b) => /^All \(\d+\)$/.test((b.textContent || "").trim()));
              return Number(
                ((button?.textContent || "").match(/\d+/) || ["-1"])[0]
              );
            });
            const match = shown === expected;
            return {
              doneAt,
              facts: { changesShown: shown, changesExpectedByEngine: expected },
              ...(match
                ? {}
                : {
                    status: "failed" as const,
                    reason: `UI showed ${shown} changes, engine expects ${expected}`,
                  }),
            };
          })
        );
        await page.keyboard.press("Escape");
      } else {
        result.steps.push(
          skipped("baseline", "open comparison", "baseline could not be stored")
        );
      }

      // --- Export.
      result.steps.push(
        await timedStep(
          page,
          "export",
          "open Exports (Universal JSON preview)",
          async () => {
            await page
              .getByRole("tab", { name: /Exports/ })
              .first()
              .click({ timeout });
            const doneAt = await frameWhen(
              page,
              `() => Boolean(document.querySelector('#export-panel-universal pre, [aria-labelledby="export-tab-universal"] pre'))`,
              null,
              timeout
            );
            return { doneAt };
          }
        )
      );
      result.steps.push(
        await timedStep(
          page,
          "export",
          "switch to ODM-XML preview",
          async () => {
            // The format tabs are reached by keyboard (Arrow keys move between
            // tabs); whether a pointer can hit the tab is recorded separately.
            const odmTab = page.locator("#export-tab-odm");
            const pointerClickable = await odmTab
              .click({ trial: true, timeout: 2_000 })
              .then(() => true)
              .catch(() => false);
            await page.locator("#export-tab-universal").focus({ timeout });
            const started = await now(page);
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowRight");
            const doneAt = await frameWhen(
              page,
              `() => Boolean(document.querySelector('[aria-labelledby="export-tab-odm"] pre'))`,
              null,
              timeout
            );
            return {
              startedAt: started,
              doneAt,
              facts: { odmTabPointerClickable: pointerClickable },
            };
          }
        )
      );
      result.steps.push(
        await timedStep(page, "export", "download ODM-XML", async () => {
          const [download] = await Promise.all([
            page.waitForEvent("download", { timeout }),
            page
              .getByRole("button", { name: /Download File/ })
              .first()
              .click({ timeout }),
          ]);
          const doneAt = await now(page);
          const target = path.join(
            os.tmpdir(),
            `crf-bench-${id}-${Date.now()}.xml`
          );
          await download.saveAs(target);
          const bytes = fs.statSync(target).size;
          fs.rmSync(target, { force: true });
          return {
            doneAt,
            facts: { bytes, filename: download.suggestedFilename() },
          };
        })
      );
      for (const format of ["docx", "pdf"] as const) {
        const label = format === "docx" ? "Word (.docx)" : "PDF (.pdf)";
        result.steps.push(
          await timedStep(
            page,
            "export",
            `annotated ${label}, all forms (click to download)`,
            async () => {
              if (
                !(await page
                  .getByRole("button", { name: /Annotated Submission aCRF/ })
                  .isVisible()
                  .catch(() => false))
              ) {
                await page
                  .getByRole("button", { name: /Export Word \/ PDF/ })
                  .first()
                  .click({ timeout });
                await page
                  .getByRole("button", { name: /Annotated Submission aCRF/ })
                  .click({ timeout });
              }
              const started = await now(page);
              const [download] = await Promise.all([
                page.waitForEvent("download", { timeout }),
                page
                  .getByRole("button", {
                    name: new RegExp(
                      `Export ${format === "docx" ? "Word \\(\\.docx\\)" : "PDF \\(\\.pdf\\)"}`
                    ),
                  })
                  .click({ timeout }),
              ]);
              const doneAt = await now(page);
              const target = path.join(
                os.tmpdir(),
                `crf-bench-${id}-${Date.now()}.${format}`
              );
              await download.saveAs(target);
              const bytes = fs.statSync(target).size;
              fs.rmSync(target, { force: true });
              return { startedAt: started, doneAt, facts: { bytes } };
            }
          )
        );
      }
      await page.keyboard.press("Escape");
      // --- Storage headroom: how many baseline snapshots of this study fit
      // beside its draft before the browser refuses the write (the studio
      // keeps up to 50), and whether a refused write leaves the draft intact.
      try {
        const record = JSON.parse(seeds.baselineRaw)[0];
        const headroom = await page.evaluate(
          ({ baselineKey, draftKey, recordJson }) => {
            const draftBefore = localStorage.getItem(draftKey);
            let fitted = 0;
            let refusal = "";
            for (let count = 1; count <= 50; count++) {
              try {
                localStorage.setItem(
                  baselineKey,
                  `[${Array(count).fill(recordJson).join(",")}]`
                );
                fitted = count;
              } catch (error) {
                refusal = `${(error as Error).name}`;
                break;
              }
            }
            return {
              fitted,
              refusal,
              draftIntact: localStorage.getItem(draftKey) === draftBefore,
            };
          },
          {
            baselineKey: STUDY_BASELINES_STORAGE_KEY,
            draftKey: STUDY_DRAFT_STORAGE_KEY,
            recordJson: JSON.stringify(record),
          }
        );
        result.steps.push({
          workflow: "baseline",
          step: "baseline snapshots that fit beside the draft (studio allows 50)",
          status: headroom.draftIntact ? "passed" : "failed",
          facts: {
            baselinesFitted: headroom.fitted,
            refusedWith: headroom.refusal || "none",
            draftIntactAfterRefusal: headroom.draftIntact,
          },
          ...(headroom.draftIntact
            ? {}
            : { reason: "draft changed after a refused baseline write" }),
        });
      } catch (error) {
        result.steps.push(
          stepFailure(
            "baseline",
            "baseline snapshots that fit beside the draft (studio allows 50)",
            error
          )
        );
      }
      result.heap.push(await sampleHeap(session, "end of session"));
    }
  } catch (error) {
    result.steps.push(stepFailure("session", "workload session", error));
  } finally {
    await context.close().catch(() => undefined);
  }

  // --- Reopen from files in clean profiles: the native .crf.json is the
  // recovery path when local storage cannot hold the draft, and the ODM-XML
  // reimport exercises the browser's DOMParser the engine phase cannot use.
  result.steps.push(
    ...(await importFile(browser, baseUrl, timeout, {
      step: "import native .crf.json (file chosen to studio shows study)",
      name: `${seeds.draft.protocolNumber}.crf.json`,
      mimeType: "application/json",
      content: seeds.nativeFile,
      formName: firstForm.name,
    }))
  );
  result.steps.push(
    ...(await importFile(browser, baseUrl, timeout, {
      step: "import ODM-XML export (file chosen to studio shows study)",
      name: `study-${seeds.draft.protocolNumber}-odm.xml`,
      mimeType: "application/xml",
      content: exportStudyToCdiscOdmXml(seeds.draft),
      formName: firstForm.name,
    }))
  );
  return result;
}

/**
 * Imports one file through the Exports importer in a clean profile and
 * records how long until the studio holds the study, then whether the
 * resulting autosave fits in local storage.
 */
async function importFile(
  browser: Browser,
  baseUrl: string,
  timeout: number,
  file: {
    step: string;
    name: string;
    mimeType: string;
    content: string;
    formName: string;
  }
): Promise<BrowserStepResult[]> {
  const steps: BrowserStepResult[] = [];
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(INSTRUMENTATION);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/crf#mode=export`, {
      waitUntil: "load",
      timeout,
    });
    await page.waitForSelector('input[type="file"]', {
      state: "attached",
      timeout,
    });
    const imported = await timedStep(
      page,
      "save-reopen",
      file.step,
      async () => {
        await page
          .locator('input[type="file"]')
          .first()
          .setInputFiles({
            name: file.name,
            mimeType: file.mimeType,
            buffer: Buffer.from(file.content),
          });
        // Exports mode has no study spine; the scope picker lists the forms.
        const ready = frameWhen(
          page,
          `(name) => Array.from(document.querySelectorAll('[aria-label="Filter export domain scope"] option')).some((option) => option.textContent.includes(name))`,
          file.formName,
          timeout
        );
        // A study with conformance findings stops at a preflight panel first.
        const proceed = page
          .getByRole("button", {
            name: /Proceed with Warnings|Auto-Fix & Import/,
          })
          .first();
        let preflight = "none";
        await Promise.race([
          proceed.waitFor({ state: "visible", timeout }).then(async () => {
            preflight = ((await proceed.textContent()) || "").trim();
            await proceed.click();
          }),
          ready,
        ]).catch(() => undefined);
        return {
          doneAt: await ready,
          facts: { bytes: Buffer.byteLength(file.content), preflight },
        };
      }
    );
    steps.push(imported);
    if (imported.status === "passed") {
      steps.push(
        await timedStep(
          page,
          "save-reopen",
          `${file.step.split(" (")[0]}: autosave`,
          async () => {
            const doneAt = await frameWhen(
              page,
              `() => { const s = document.querySelector('[data-testid="draft-save-status"]'); return Boolean(s && /Saved locally|Local save failed/.test(s.textContent)); }`,
              null,
              timeout
            );
            const status = (
              (await page
                .locator('[data-testid="draft-save-status"]')
                .textContent()) || ""
            ).trim();
            const failed = /Local save failed/.test(status);
            const offersDownload = failed
              ? (await page
                  .getByRole("button", { name: "Download draft" })
                  .count()) > 0
              : null;
            return {
              doneAt,
              facts: { status, offersDownloadDraft: offersDownload },
              ...(failed ? { status: "failed" as const, reason: status } : {}),
            };
          }
        )
      );
    }
  } catch (error) {
    steps.push(stepFailure("save-reopen", file.step, error));
  } finally {
    await context.close().catch(() => undefined);
  }
  return steps;
}

/**
 * Times the benchmark's input sequences against a trivial page, so the share
 * of each studio latency spent in Playwright dispatch and frame polling is
 * known rather than assumed.
 */
async function measureAutomationOverhead(
  browser: Browser
): Promise<Record<string, number> | null> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(INSTRUMENTATION);
  try {
    const page = await context.newPage();
    await page.setContent(
      '<input id="a" value="label"><button id="b">x</button>'
    );
    const timeIt = async (action: () => Promise<void>, predicate: string) => {
      const started = await now(page);
      await action();
      return Math.round(
        (await frameWhen(page, predicate, null, 10_000)) - started
      );
    };
    const click = await timeIt(() => page.locator("#b").click(), "() => true");
    const type7 = await timeIt(async () => {
      await page.locator("#a").click();
      await page.keyboard.press("End");
      await page.keyboard.type(" edited");
    }, `() => document.querySelector('#a').value.endsWith(' edited')`);
    const arrow10 = await timeIt(async () => {
      for (let press = 0; press < 10; press++)
        await page.keyboard.press("ArrowDown");
    }, "() => true");
    return { click, type7, arrow10 };
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Folds repeated sessions of one workload into one result: latency samples
 * are pooled, responsiveness keeps the median count and the worst maxima, and
 * a step passes only if it passed in every run.
 */
function mergeRuns(runs: WorkloadBrowserResult[]): WorkloadBrowserResult {
  const [first] = runs;
  const keys: string[] = [];
  for (const run of runs)
    for (const step of run.steps) {
      const key = `${step.workflow}::${step.step}`;
      if (!keys.includes(key)) keys.push(key);
    }
  const steps: BrowserStepResult[] = keys.map((key) => {
    const found = runs
      .map((run) =>
        run.steps.find((step) => `${step.workflow}::${step.step}` === key)
      )
      .filter((step): step is BrowserStepResult => Boolean(step));
    const samples = found.flatMap((step) => step.timing?.samples || []);
    const failed = found.filter((step) => step.status === "failed");
    const skippedSteps = found.filter((step) => step.status === "skipped");
    const status: StepStatus = failed.length
      ? "failed"
      : skippedSteps.length === found.length
        ? "skipped"
        : skippedSteps.length
          ? "failed"
          : "passed";
    const responsiveness = found
      .map((step) => step.responsiveness)
      .filter((value): value is Responsiveness => Boolean(value));
    const events = responsiveness
      .map((value) => value.maxEventMs)
      .filter((value): value is number => value !== null);
    const reasons = Array.from(
      new Set(
        [...failed, ...skippedSteps].map((step) => step.reason).filter(Boolean)
      )
    );
    return {
      workflow: found[0].workflow,
      step: found[0].step,
      status,
      ...(samples.length ? { timing: summarizeTimings(samples) } : {}),
      ...(found[found.length - 1].facts
        ? { facts: found[found.length - 1].facts }
        : {}),
      ...(reasons.length
        ? {
            reason: `${reasons.join("; ")}${runs.length > 1 ? ` (${failed.length + skippedSteps.length}/${runs.length} runs)` : ""}`,
          }
        : {}),
      ...(responsiveness.length
        ? {
            responsiveness: {
              longTasks: Math.round(
                median(responsiveness.map((value) => value.longTasks))
              ),
              longTaskTotalMs: Math.round(
                median(responsiveness.map((value) => value.longTaskTotalMs))
              ),
              longTaskMaxMs: Math.max(
                ...responsiveness.map((value) => value.longTaskMaxMs)
              ),
              maxEventMs: events.length ? Math.max(...events) : null,
            },
          }
        : {}),
    };
  });
  return {
    ...first,
    runs: runs.length,
    steps,
    heap: runs[runs.length - 1].heap,
    pageErrors: Array.from(new Set(runs.flatMap((run) => run.pageErrors))),
    crashed: runs.some((run) => run.crashed),
  };
}

/** Binary-searches how many UTF-16 characters one localStorage value may hold. */
async function probeLocalStorageCapacity(
  browser: Browser,
  baseUrl: string
): Promise<number | null> {
  const context = await browser.newContext();
  await context.addInitScript(INSTRUMENTATION);
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/robots.txt`);
    return await page.evaluate(() => {
      let low = 0;
      let high = 64 * 1024 * 1024;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        try {
          localStorage.setItem("crf-bench-probe", "x".repeat(mid));
          localStorage.removeItem("crf-bench-probe");
          low = mid;
        } catch {
          high = mid - 1;
        }
      }
      return low;
    });
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

export async function runBrowserPhase(
  options: CrfBenchmarkOptions
): Promise<BrowserPhaseResult> {
  const baseUrl = (
    options.baseUrl || `http://localhost:${options.port}`
  ).replace(/\/$/, "");
  const phase: BrowserPhaseResult = {
    status: "passed",
    baseUrl,
    serverOwned: !options.baseUrl,
    chromium: null,
    playwright: readPlaywrightVersion(),
    viewport: VIEWPORT,
    localStorageCapacityChars: null,
    automationOverheadMs: null,
    workloads: [],
  };
  let server: ChildProcess | null = null;
  if (!options.baseUrl) {
    if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) {
      return {
        ...phase,
        status: "skipped",
        reason: "No production build in .next; run `npm run build` first.",
      };
    }
    server = startServer(options.port);
  }
  let browser: Browser | null = null;
  try {
    if (!(await waitForServer(`${baseUrl}/robots.txt`, 60_000))) {
      return {
        ...phase,
        status: "failed",
        reason: `Server at ${baseUrl} did not respond within 60 s.`,
      };
    }
    browser = await launchChromiumWithFallback({ headless: true });
    phase.chromium = browser.version();
    phase.localStorageCapacityChars = await probeLocalStorageCapacity(
      browser,
      baseUrl
    );
    phase.automationOverheadMs = await measureAutomationOverhead(browser);
    for (const id of options.workloads) {
      console.log(`\n[browser] ${id}`);
      const runs: WorkloadBrowserResult[] = [];
      for (let run = 0; run < options.browserRuns; run++) {
        console.log(`  run ${run + 1}/${options.browserRuns}`);
        runs.push(await runWorkload(browser, baseUrl, id, options));
      }
      const workload = mergeRuns(runs);
      for (const step of workload.steps) {
        const r = step.responsiveness;
        console.log(
          `  ${step.status.padEnd(7)} ${step.workflow} / ${step.step}: ${step.timing ? `${step.timing.median.toFixed(0)} ms` : "n/a"}${r ? ` | long tasks ${r.longTasks} (max ${r.longTaskMaxMs} ms, total ${r.longTaskTotalMs} ms) | max event ${r.maxEventMs ?? "-"} ms` : ""}${step.reason ? ` (${step.reason})` : ""}`
        );
      }
      for (const sample of workload.heap)
        console.log(
          `  heap ${sample.label}: ${(sample.jsHeapUsedBytes / 1048576).toFixed(1)} MiB, ${sample.domNodes} DOM nodes`
        );
      if (workload.pageErrors.length)
        console.log(`  page errors: ${workload.pageErrors.join(" | ")}`);
      phase.workloads.push(workload);
    }
  } catch (error) {
    phase.status = "failed";
    phase.reason = error instanceof Error ? error.message : String(error);
  } finally {
    await browser?.close().catch(() => undefined);
    if (server && server.exitCode === null) server.kill("SIGTERM");
  }
  return phase;
}

/** Renders the browser results as a markdown section. */
export function renderBrowserMarkdown(phase: BrowserPhaseResult): string {
  const lines: string[] = [];
  lines.push(
    `### Browser phase (headless Chromium ${phase.chromium ?? "unknown"}, Playwright ${phase.playwright ?? "unknown"}, ${phase.viewport.width}x${phase.viewport.height})`
  );
  lines.push("");
  if (phase.status !== "passed")
    lines.push(`**Phase ${phase.status}**: ${phase.reason}`);
  lines.push(
    `- Target: ${phase.baseUrl} (${phase.serverOwned ? "server started by the benchmark from .next" : "external server"})`
  );
  lines.push(
    `- Automation overhead on a trivial page (ms): ${
      phase.automationOverheadMs
        ? Object.entries(phase.automationOverheadMs)
            .map(([key, value]) => `${key} ${value}`)
            .join(", ")
        : "not measured"
    }`
  );
  lines.push(
    `- Largest single localStorage value accepted: ${phase.localStorageCapacityChars === null ? "not measured" : `${phase.localStorageCapacityChars.toLocaleString("en-US")} characters`}`
  );
  lines.push("");
  if (!phase.workloads.length) return lines.join("\n");
  const keys = phase.workloads[0].steps.map(
    (step) => `${step.workflow}::${step.step}`
  );
  for (const workload of phase.workloads)
    for (const step of workload.steps) {
      const key = `${step.workflow}::${step.step}`;
      if (!keys.includes(key)) keys.push(key);
    }
  lines.push(
    "Cells: median ms [slowest run ms] (long tasks / longest task ms / longest input event ms)."
  );
  lines.push("");
  lines.push(
    `| Workflow | Step | ${phase.workloads.map((w) => `${w.workload} (${w.runs ?? 1} runs)`).join(" | ")} |`
  );
  lines.push(`| --- | --- | ${phase.workloads.map(() => "---").join(" | ")} |`);
  for (const key of keys) {
    const [workflow, step] = key.split("::");
    const cells = phase.workloads.map((workload) => {
      const found = workload.steps.find(
        (candidate) => `${candidate.workflow}::${candidate.step}` === key
      );
      if (!found) return "not run";
      const r = found.responsiveness;
      const time = found.timing
        ? `${found.timing.median.toFixed(0)}${found.timing.samples.length > 1 ? ` [${found.timing.max.toFixed(0)}]` : ""}`
        : "";
      const resp = r
        ? ` (${r.longTasks} / ${r.longTaskMaxMs} / ${r.maxEventMs ?? "-"})`
        : "";
      if (found.status !== "passed")
        return `**${found.status}**${time ? ` ${time}` : ""}${resp}: ${found.reason}`;
      return time ? `${time}${resp}` : "passed (see facts)";
    });
    lines.push(`| ${workflow} | ${step} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("Facts recorded per workload:");
  lines.push("");
  for (const workload of phase.workloads) {
    for (const step of workload.steps) {
      if (!step.facts) continue;
      const facts = Object.entries(step.facts)
        .map(([key, value]) =>
          typeof value === "number" && /bytes/i.test(key)
            ? `${key}=${(value / 1024).toFixed(0)} KiB`
            : `${key}=${value}`
        )
        .join(", ");
      lines.push(
        `- ${workload.workload}, ${step.workflow} / ${step.step}: ${facts}`
      );
    }
  }
  lines.push("");
  lines.push(
    "| Workload | Draft | Baseline record | Native file | Heap after reopen | Heap at end | DOM nodes at end | Page errors |"
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const workload of phase.workloads) {
    const heap = (label: string) =>
      workload.heap.find((sample) => sample.label === label);
    const mib = (sample?: HeapSample) =>
      sample ? `${(sample.jsHeapUsedBytes / 1048576).toFixed(1)} MiB` : "n/a";
    lines.push(
      `| ${workload.workload} | ${(workload.draftBytes / 1024).toFixed(0)} KiB | ${(workload.baselineBytes / 1024).toFixed(0)} KiB | ${(workload.nativeFileBytes / 1024).toFixed(0)} KiB | ${mib(heap("after reopen"))} | ${mib(heap("end of session"))} | ${heap("end of session")?.domNodes ?? "n/a"} | ${workload.crashed ? "page crashed; " : ""}${workload.pageErrors.length ? workload.pageErrors.join("; ") : "none"} |`
    );
  }
  return lines.join("\n");
}
