/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  computePlanDigest,
  generateBlockSchedule,
  generateMinimizationSchedule,
  groupAllocationBlocks,
  queryAllocationRows,
  summarizeAllocationResults,
  type AllocationRow,
  type BlockRandomizationRequest,
  type MinimizationRandomizationRequest,
  type RandomizationRequest,
} from "@/lib/randomization";
import {
  RANDOMIZATION_PROTOCOL_VERSION,
  parseRandomizationCommand,
  type RandomizationResponse,
} from "@/components/randomization/protocol";
import { createRandomizationHost } from "@/components/randomization/randomization-session";

const downloads = vi.hoisted(() => [] as { content: string; name: string }[]);
vi.mock("@/lib/download", () => ({
  downloadFile: (content: string, name: string) => {
    downloads.push({ content, name });
  },
}));
const clipboard = vi.hoisted(() => ({
  written: [] as string[],
  fail: false,
}));
vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: async (text: string) => {
    if (clipboard.fail) throw new Error("denied");
    clipboard.written.push(text);
  },
}));
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";

afterEach(() => {
  cleanup();
  downloads.length = 0;
  clipboard.written.length = 0;
  clipboard.fail = false;
});

/** Paged allocations, grouped blocks and balance (#4008). */

const PROVENANCE = {
  studyId: "study-1",
  studyVersionId: "v1",
  studyDesignId: "d1",
  workspaceRevisionId: "r1",
  usdmSha256: "0".repeat(64),
};

function blockPlan(
  overrides: Partial<BlockRandomizationRequest> = {}
): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-block",
    name: "Synthetic block plan",
    provenance: PROVENANCE,
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 2 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      {
        id: "site-1",
        code: "S01",
        label: "North clinic",
        recruitmentWeight: 1,
      },
      {
        id: "site-2",
        code: "S02",
        label: "South clinic",
        recruitmentWeight: 1,
      },
    ],
    factors: [
      {
        id: "sex",
        code: "SEX",
        label: "Sex",
        levels: [
          { id: "sex-f", code: "F", label: "Female" },
          { id: "sex-m", code: "M", label: "Male" },
        ],
      },
    ],
    seed: { value: "ResultsSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: 40,
    caps: {
      strategy: "manual",
      capScope: "per-site",
      intersectionCaps: [
        { stratumKey: '[["sex","sex-f"]]', cap: 10 },
        { stratumKey: '[["sex","sex-m"]]', cap: 10 },
      ],
    },
    blockSettings: {
      defaultRule: { mode: "fixed-sequence", sizes: [6] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
    ...overrides,
  };
}

function minimizationPlan(n = 30): MinimizationRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-min",
    name: "Synthetic minimization plan",
    provenance: PROVENANCE,
    method: "MINIMIZATION",
    algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 1 },
    ],
    factors: blockPlan().factors,
    seed: { value: "MinSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:5}" },
    enrollmentTarget: n,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      levelCaps: [],
      totalEnrollment: n,
    },
    minimizationSettings: { virtualCohortSize: n, biasedCoinProbability: 0.8 },
  };
}

function blockRows(plan: BlockRandomizationRequest): readonly AllocationRow[] {
  const generated = generateBlockSchedule(plan);
  if (!generated.ok) throw new Error(generated.findings[0]?.code);
  return generated.rows;
}

const ALL = { offset: 0, limit: 500 };
const OPEN = { maskTreatment: false };
const MASKED = { maskTreatment: true };

/** Two strata whose labels abbreviate the same way, at two sites. */
function collidingFixture(): {
  request: RandomizationRequest;
  rows: AllocationRow[];
} {
  const request = blockPlan({
    factors: [
      {
        id: "age",
        code: "AGE",
        label: "Age",
        levels: [
          { id: "age-young", code: "Y", label: "Adult" },
          { id: "age-old", code: "O", label: "Adult" },
        ],
      },
    ],
  });
  const row = (
    sequence: number,
    siteId: string,
    levelId: string,
    blockIndex: number,
    armId: string
  ): AllocationRow => ({
    sequence,
    subjectId: `S-${sequence}`,
    siteId,
    stratumKey: JSON.stringify([["age", levelId]]),
    stratumLevels: { age: levelId },
    armId,
    armCode: armId === "arm-a" ? "A" : "P",
    blockIndex,
    blockSize: 3,
    positionInBlock: 1,
  });
  return {
    request,
    rows: [
      row(1, "site-1", "age-young", 1, "arm-a"),
      row(2, "site-1", "age-young", 1, "arm-p"),
      row(3, "site-1", "age-young", 1, "arm-a"),
      row(4, "site-1", "age-old", 1, "arm-a"),
      row(5, "site-2", "age-young", 1, "arm-p"),
      row(6, "site-2", "age-young", 1, "arm-a"),
    ],
  };
}

describe("result projections", () => {
  it("keeps generated order, and a sort cycle back to none restores it", () => {
    const plan = blockPlan();
    const rows = blockRows(plan);
    const original = queryAllocationRows(plan, rows, {}, ALL, OPEN);
    expect(original.rows.map((r) => r.sequence)).toEqual(
      rows.map((r) => r.sequence)
    );
    const ascending = queryAllocationRows(
      plan,
      rows,
      { sort: { column: "site", direction: "ascending" } },
      ALL,
      OPEN
    );
    const sites = ascending.rows.map((r) => r.siteId);
    expect(sites).toEqual([...sites].sort());
    // Ties keep generated order.
    const north = ascending.rows.filter((r) => r.siteId === "site-1");
    expect(north.map((r) => r.sequence)).toEqual(
      [...north.map((r) => r.sequence)].sort((a, b) => a - b)
    );
    const descending = queryAllocationRows(
      plan,
      rows,
      { sort: { column: "sequence", direction: "descending" } },
      ALL,
      OPEN
    );
    expect(descending.rows[0].sequence).toBe(rows.length);
    expect(
      queryAllocationRows(plan, rows, { sort: null }, ALL, OPEN).rows
    ).toEqual(original.rows);
  });

  it("filters by case-insensitive contains, composes filters and pages", () => {
    const plan = blockPlan();
    const rows = blockRows(plan);
    const north = queryAllocationRows(
      plan,
      rows,
      { filters: { site: "NORTH" } },
      ALL,
      OPEN
    );
    expect(north.matchingRows).toBe(
      rows.filter((r) => r.siteId === "site-1").length
    );
    expect(north.totalRows).toBe(rows.length);
    const composed = queryAllocationRows(
      plan,
      rows,
      {
        filters: { site: "north", factors: { sex: "fem" }, treatment: "plac" },
      },
      ALL,
      OPEN
    );
    expect(composed.matchingRows).toBe(
      rows.filter(
        (r) =>
          r.siteId === "site-1" &&
          r.stratumLevels.sex === "sex-f" &&
          r.armId === "arm-p"
      ).length
    );
    const page = queryAllocationRows(
      plan,
      rows,
      {},
      { offset: 5, limit: 7 },
      OPEN
    );
    expect(page.rows.map((r) => r.sequence)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it("ignores every treatment part of a query while treatment is masked", () => {
    const plan = blockPlan();
    const rows = blockRows(plan);
    const masked = queryAllocationRows(
      plan,
      rows,
      {
        filters: { treatment: "Active" },
        sort: { column: "treatment", direction: "ascending" },
        category: { dimension: "treatment", key: "arm-a" },
      },
      ALL,
      MASKED
    );
    expect(masked.matchingRows).toBe(rows.length);
    expect(masked.rows.map((r) => r.sequence)).toEqual(
      rows.map((r) => r.sequence)
    );
    expect(masked.ignored).toEqual([
      "treatment-filter",
      "treatment-category",
      "treatment-sort",
    ]);
    const summary = summarizeAllocationResults(plan, rows, {}, MASKED);
    const treatment = summary.categories.find(
      (c) => c.dimension === "treatment"
    );
    expect(treatment?.entries).toEqual([
      { key: "Blinded", label: "Blinded", count: rows.length, percent: 100 },
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/Active|Placebo|arm-a|arm-p/);
    const groups = groupAllocationBlocks(plan, rows, {}, ALL, MASKED);
    expect(groups.groups.every((g) => g.armCounts === null)).toBe(true);
  });

  it("never merges blocks across sites or strata with the same display label", () => {
    const { request, rows } = collidingFixture();
    const page = groupAllocationBlocks(request, rows, {}, ALL, OPEN);
    expect(page.totalGroups).toBe(3);
    expect(
      page.groups.map((g) => [g.siteId, g.stratumKey, g.blockIndex, g.filled])
    ).toEqual([
      ["site-1", '[["age","age-young"]]', 1, 3],
      ["site-1", '[["age","age-old"]]', 1, 1],
      ["site-2", '[["age","age-young"]]', 1, 2],
    ]);
    // Same display label, distinct keys.
    expect(page.groups[0].stratumLabel).toBe(page.groups[1].stratumLabel);
    expect(new Set(page.groups.map((g) => g.key)).size).toBe(3);
    expect(page.groups.map((g) => g.complete)).toEqual([true, false, false]);
    expect(page.groups[0].armCounts).toEqual([2, 1]);
  });

  it("keeps a block's own fill when a filter matches only part of it", () => {
    const { request, rows } = collidingFixture();
    const page = groupAllocationBlocks(
      request,
      rows,
      { filters: { subjectId: "S-2" } },
      ALL,
      OPEN
    );
    expect(page.groups).toHaveLength(1);
    expect(page.groups[0]).toMatchObject({
      filled: 3,
      matching: 1,
      complete: true,
    });
  });

  it("states balance against the planned ratio and independent counts", () => {
    const plan = blockPlan();
    const rows = blockRows(plan);
    const { balance } = summarizeAllocationResults(plan, rows, {}, OPEN);
    expect(balance.ratios).toEqual([2, 1]);
    const total = rows.length;
    const active = rows.filter((r) => r.armId === "arm-a").length;
    expect(balance.global.total).toBe(total);
    expect(balance.global.arms?.[0]).toMatchObject({
      actual: active,
      target: (total * 2) / 3,
      difference: active - (total * 2) / 3,
    });
    for (const site of balance.sites) {
      const siteRows = rows.filter((r) => r.siteId === site.key);
      expect(site.total).toBe(siteRows.length);
      expect(site.arms?.[1].actual).toBe(
        siteRows.filter((r) => r.armId === "arm-p").length
      );
    }
    // Caps of 10 with blocks of 6 leave a partial tail in every cell.
    expect(balance.intersections).toHaveLength(4);
    expect(balance.intersections.every((c) => c.partialBlocks === 1)).toBe(
      true
    );
    expect(balance.global.partialBlocks).toBe(4);
    expect(balance.marginals).toEqual([]);
  });

  it("balance ignores filters while categorical counts follow them", () => {
    const plan = blockPlan();
    const rows = blockRows(plan);
    const all = summarizeAllocationResults(plan, rows, {}, OPEN);
    const filtered = summarizeAllocationResults(
      plan,
      rows,
      { category: { dimension: "site", key: "site-2" } },
      OPEN
    );
    expect(filtered.balance).toEqual(all.balance);
    expect(filtered.matchingRows).toBe(
      rows.filter((r) => r.siteId === "site-2").length
    );
    const site = filtered.categories.find((c) => c.dimension === "site");
    expect(site?.entries.map((e) => e.key)).toEqual(["site-2"]);
    expect(site?.entries[0].percent).toBe(100);
  });

  it("reports minimization margins and groups cells, not invented blocks", () => {
    const plan = minimizationPlan();
    const generated = generateMinimizationSchedule(plan);
    if (!generated.ok) throw new Error("minimization failed");
    const rows = generated.rows;
    const { balance } = summarizeAllocationResults(plan, rows, {}, OPEN);
    expect(balance.method).toBe("MINIMIZATION");
    expect(balance.marginals.map((m) => m.levelId)).toEqual(
      expect.arrayContaining(["sex-f", "sex-m"])
    );
    const female = balance.marginals.find((m) => m.levelId === "sex-f");
    expect(female?.total).toBe(
      rows.filter((r) => r.stratumLevels.sex === "sex-f").length
    );
    expect(balance.global.partialBlocks).toBe(0);
    const groups = groupAllocationBlocks(plan, rows, {}, ALL, OPEN);
    expect(groups.cellsNotBlocks).toBe(true);
    expect(
      groups.groups.every((g) => g.blockIndex === null && g.complete)
    ).toBe(true);
  });
});

describe("result views through the worker host", () => {
  function hostWithResult(plan: RandomizationRequest) {
    const responses: RandomizationResponse[] = [];
    const host = createRandomizationHost((r) => responses.push(r), {
      yieldControl: async () => {},
    });
    const identity = {
      operationId: 1,
      sessionId: "s1",
      planDigest: computePlanDigest(plan),
      workspaceRevision: 1,
    };
    host.receive({
      protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
      kind: "generate",
      requestId: 1,
      identity,
      plan,
    });
    return { host, responses, identity };
  }

  it("answers rows, blocks and summary views for the held result only", async () => {
    const plan = blockPlan({ enrollmentTarget: 40 });
    const { host, responses, identity } = hostWithResult(plan);
    await waitFor(() =>
      expect(responses.some((r) => r.kind === "complete")).toBe(true)
    );
    host.receive({
      protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
      kind: "view",
      requestId: 2,
      identity,
      view: {
        kind: "rows",
        query: { filters: { site: "south" } },
        offset: 0,
        limit: 5,
        maskTreatment: false,
      },
    });
    const rows = responses.find((r) => r.requestId === 2);
    expect(rows?.kind).toBe("view");
    if (rows?.kind === "view" && rows.result.kind === "rows") {
      expect(rows.result.page.rows).toHaveLength(5);
      expect(rows.result.page.rows.every((r) => r.siteId === "site-2")).toBe(
        true
      );
    }
    host.receive({
      protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
      kind: "view",
      requestId: 3,
      identity: { ...identity, operationId: 99 },
      view: { kind: "summary", query: {}, maskTreatment: true },
    });
    const released = responses.find((r) => r.requestId === 3);
    expect(released).toMatchObject({ kind: "failed", code: "RESULT_RELEASED" });
  });

  it("refuses unbounded or malformed queries at the protocol boundary", () => {
    const identity = {
      operationId: 1,
      sessionId: "s1",
      planDigest: "a".repeat(64),
      workspaceRevision: 1,
    };
    const command = (view: unknown) =>
      parseRandomizationCommand({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "view",
        requestId: 1,
        identity,
        view,
      });
    expect(
      command({
        kind: "rows",
        query: {},
        offset: 0,
        limit: 25,
        maskTreatment: true,
      })
    ).not.toBeNull();
    expect(
      command({
        kind: "rows",
        query: {},
        offset: 0,
        limit: 5000,
        maskTreatment: true,
      })
    ).toBeNull();
    expect(
      command({
        kind: "summary",
        query: { filters: { site: "x".repeat(121) } },
        maskTreatment: false,
      })
    ).toBeNull();
    expect(
      command({
        kind: "summary",
        query: { sort: { column: "__proto__", direction: "ascending" } },
        maskTreatment: false,
      })
    ).toBeNull();
    expect(command({ kind: "summary", query: {} })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* The results panel in the work area                                 */
/* ------------------------------------------------------------------ */

async function opened() {
  const view = render(<StudyDesignGrid />);
  await screen.findByRole("table");
  return view;
}

const area = () =>
  within(screen.getByRole("region", { name: "Randomization work area" }));
const runArea = () =>
  within(screen.getByRole("region", { name: "Run and results", hidden: true }));
const stageButton = (title: string) =>
  within(area().getByRole("navigation", { name: "Randomization stages" }))
    .getAllByRole("button")
    .find((button) => button.textContent?.endsWith(title))!;

function commit(label: string, value: string) {
  const input = area().getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

async function ranExploration() {
  const view = await opened();
  fireEvent.click(stageButton("Mechanics"));
  commit("Seed", "ResultsPanelSeed");
  fireEvent.click(stageButton("Review"));
  fireEvent.click(runArea().getByRole("button", { name: "Run" }));
  await runArea().findByText(/^16 of 16 allocations generated/);
  await runArea().findByRole("table");
  return view;
}

function unmask() {
  const disclosure = within(
    runArea().getByTestId("randomization-disclosure-controls")
  );
  fireEvent.change(disclosure.getByLabelText("Persona"), {
    target: { value: "Biostatistician" },
  });
}

describe("results panel", () => {
  it("sorts one column through ascending, descending and back to none", async () => {
    await ranExploration();
    const table = runArea().getByRole("table");
    const header = () =>
      within(runArea().getByRole("table")).getByRole("columnheader", {
        name: /Subject/,
      });
    expect(header().getAttribute("aria-sort")).toBe("none");
    const firstSubject = () =>
      within(runArea().getByRole("table")).getAllByRole("row")[1].textContent;
    const original = firstSubject();
    fireEvent.click(within(header()).getByRole("button"));
    await waitFor(() =>
      expect(header().getAttribute("aria-sort")).toBe("ascending")
    );
    fireEvent.click(within(header()).getByRole("button"));
    await waitFor(() =>
      expect(header().getAttribute("aria-sort")).toBe("descending")
    );
    await waitFor(() => expect(firstSubject()).not.toBe(original));
    fireEvent.click(within(header()).getByRole("button"));
    await waitFor(() =>
      expect(header().getAttribute("aria-sort")).toBe("none")
    );
    await waitFor(() => expect(firstSubject()).toBe(original));
    expect(table).toBeTruthy();
  });

  it("cross-filters from a chart entry and clears on a second press", async () => {
    await ranExploration();
    const siteEntry = () =>
      runArea().getByRole("button", { name: /^Site A: 8 \(50%\)/ });
    fireEvent.click(siteEntry());
    await waitFor(() =>
      expect(siteEntry().getAttribute("aria-pressed")).toBe("true")
    );
    await runArea().findByText(/^8 of 16 rows match/);
    await waitFor(() =>
      expect(
        within(runArea().getByRole("table")).getAllByRole("row")
      ).toHaveLength(9)
    );
    fireEvent.click(
      runArea().getByRole("button", { name: /^Site A: 8 \(100%\)/ })
    );
    await runArea().findByText(/^16 of 16 rows match/);
  });

  it("filters change shown counts, never the full CSV export", async () => {
    await opened();
    fireEvent.click(area().getByRole("checkbox"));
    fireEvent.click(stageButton("Review"));
    fireEvent.click(
      area().getByRole("button", { name: "Promote to a plan for this study" })
    );
    fireEvent.click(stageButton("Mechanics"));
    commit("Seed", "FilteredExport1");
    fireEvent.click(stageButton("Review"));
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    await runArea().findByRole("table");
    fireEvent.change(runArea().getByLabelText("Site contains"), {
      target: { value: "site b" },
    });
    await runArea().findByText(/^8 of 16 rows match/);
    expect(runArea().getByText(/all 16 rows in generated/)).toBeTruthy();
    fireEvent.click(runArea().getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const rows = downloads[0].content
      .split("\n")
      .filter((l) => /^\d+,/.test(l));
    expect(rows).toHaveLength(16);
    fireEvent.click(runArea().getByRole("button", { name: "Clear filters" }));
    await runArea().findByText(/^16 of 16 rows match/);
  });

  it("keeps treatment masked in every view until the profile unmasks it", async () => {
    await ranExploration();
    expect(
      (runArea().getByLabelText("Treatment contains") as HTMLInputElement)
        .disabled
    ).toBe(true);
    const arm = within(runArea().getByRole("table")).getByRole("columnheader", {
      name: /Arm/,
    });
    expect(
      (within(arm).getByRole("button") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(runArea().getByText(/^Blinded: 16 \(100%\)/)).toBeTruthy();
    expect(
      runArea().getByText(/hidden while treatment is masked/)
    ).toBeTruthy();
    fireEvent.click(runArea().getByRole("button", { name: "Grouped" }));
    await runArea().findByRole("table", { name: /^Blocks/ });
    expect(runArea().queryByText(/^T \d+ · C \d+$/)).toBeNull();
    fireEvent.click(runArea().getByRole("button", { name: "Balance" }));
    await runArea().findByText(/Per-arm balance is hidden/);
    const text = screen.getByRole("region", {
      name: "Run and results",
      hidden: true,
    }).textContent;
    expect(text).not.toMatch(/Treatment: \d|Control: \d/);

    unmask();
    await runArea().findByRole("table", { name: "Whole study" });
    expect(runArea().getByRole("table", { name: "By site" })).toBeTruthy();
    expect(runArea().getByText(/planned ratio 1:1/)).toBeTruthy();
    fireEvent.click(runArea().getByRole("button", { name: "Grouped" }));
    await waitFor(() =>
      expect(runArea().getAllByText(/^T \d+ · C \d+$/).length).toBeGreaterThan(
        0
      )
    );
    expect(runArea().getByText(/^ResultsPanelSeed \(custom\)$/)).toBeTruthy();
  });

  it("copies the full digest and says truthfully when copying fails", async () => {
    await ranExploration();
    const digest = runArea()
      .getByTitle(/^[0-9a-f]{64}$/)
      .getAttribute("data-digest");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    fireEvent.click(runArea().getByRole("button", { name: "Copy digest" }));
    await runArea().findByText("Copied the full digest.");
    expect(clipboard.written).toEqual([digest]);
    clipboard.fail = true;
    fireEvent.click(runArea().getByRole("button", { name: "Copy digest" }));
    await runArea().findByText(/Couldn't copy/);
    expect(clipboard.written).toHaveLength(1);
  });

  it("renders a bounded page, not a row per allocation", async () => {
    await ranExploration();
    // The default exploration has 16 rows; the page size bounds any larger one.
    const rows = within(runArea().getByRole("table")).getAllByRole("row");
    expect(rows.length).toBeLessThanOrEqual(26);
    expect(
      runArea().queryByRole("button", { name: /Mark as dropped/i })
    ).toBeNull();
    expect(
      runArea().queryByRole("button", { name: /stratum details/i })
    ).toBeNull();
  });

  it("has no axe violations in the flat, grouped and balance views", async () => {
    const { container } = await ranExploration();
    unmask();
    for (const view of ["Allocations", "Grouped", "Balance"]) {
      fireEvent.click(runArea().getByRole("button", { name: view }));
      await waitFor(() =>
        expect(runArea().getAllByRole("table").length).toBeGreaterThan(0)
      );
      const results = await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(results.violations.map((v) => v.id)).toEqual([]);
    }
  });
});
