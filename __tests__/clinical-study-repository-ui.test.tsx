/**
 * @vitest-environment jsdom
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type UsdmV4Document,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4StudyVersion,
} from "@/lib/clinical-standards";
import { DEMO_301_STUDY, DEMO_301_USDM, SUBJECT_COUNT_LIMITS } from "@/lib/study-data";
import type { BroadcastChannelLike } from "@/lib/study-workspace";
import { StudyPicker } from "@/components/clinical/StudyPicker";
import {
  createStudyRepositoryClient,
  type StudyRepositoryClient,
} from "@/components/clinical/study-repository-client";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import { StudyDataWorkbench } from "@/components/study-data/StudyDataWorkbench";
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";
import { cloneDeep } from "@/lib/utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/crf",
  useSearchParams: () => new URLSearchParams(),
}));

class MemoryBroadcastHub {
  private readonly channels = new Set<HubChannel>();

  create = (name: string): BroadcastChannelLike => {
    const channel = new HubChannel(name, this.channels);
    this.channels.add(channel);
    return channel;
  };
}

class HubChannel implements BroadcastChannelLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  private closed = false;

  constructor(
    private readonly name: string,
    private readonly peers: Set<HubChannel>
  ) {}

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void {
    this.listeners.delete(listener);
  }

  postMessage(message: unknown): void {
    if (this.closed) return;
    for (const peer of this.peers) {
      if (peer !== this && !peer.closed && peer.name === this.name) {
        const event = new MessageEvent("message", { data: message });
        peer.onmessage?.(event);
        for (const listener of peer.listeners) {
          listener(event);
        }
      }
    }
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
    this.peers.delete(this);
  }
}

function namespaceUsdmSubtree<T>(subtree: T, prefix: string): T {
  const idMap = new Map<string, string>();
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.id === "string" && typeof rec.instanceType === "string") {
      idMap.set(rec.id, `${prefix}-${rec.id}`);
    }
    Object.values(rec).forEach(collect);
  };
  collect(subtree);

  const rewrite = (node: unknown, keyName?: string): unknown => {
    if (typeof node === "string") {
      if (
        keyName &&
        (keyName === "id" ||
          keyName.endsWith("Id") ||
          keyName.endsWith("Ids")) &&
        idMap.has(node)
      ) {
        return idMap.get(node)!;
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item) => rewrite(item, keyName));
    }
    if (typeof node !== "object" || node === null) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = rewrite(v, k);
    }
    return out;
  };
  return rewrite(subtree) as T;
}

const { design } = DEMO_301_STUDY;
const scheduleDesign = {
  studyId: DEMO_301_STUDY.studyId,
  title: DEMO_301_STUDY.title,
  phase: design.phase,
  blinding: design.blinding,
  arms: design.arms.map((arm) => ({ id: arm.id, name: arm.name })),
  visits: design.visits.map((visit) => ({
    id: visit.id,
    name: visit.name,
    visitNum: visit.visitNum,
    targetDay: visit.targetDay,
    windowBefore: visit.windowBefore,
    windowAfter: visit.windowAfter,
  })),
  activities: design.activities.map((activity) => ({
    id: activity.id,
    name: activity.name,
    domain: activity.domain,
    tests: activity.assessments.map((assessment) => assessment.testCode),
  })),
  schedule: design.schedule.map((cell) => ({
    visitId: cell.visitId,
    activityId: cell.activityId,
  })),
};

function renderStudyData(repository: StudyRepositoryClient) {
  return render(
    <StudyDataWorkbench
      design={scheduleDesign}
      definitionCounts={{
        arms: design.arms.length,
        visits: design.visits.length,
        activities: design.activities.length,
        scheduled: design.schedule.length,
      }}
      limits={SUBJECT_COUNT_LIMITS}
      defaults={{ seed: 301, nSubjects: 30 }}
      repository={repository}
    />
  );
}

function buildMultiChoiceUsdm(): UsdmV4Document {
  const doc = cloneDeep(DEMO_301_USDM);
  doc.study.name = "SYNC-500";
  const templateVersion = doc.study.versions?.[0];
  if (!templateVersion) throw new Error("Expected DEMO_301_USDM version");

  const v1 = namespaceUsdmSubtree(
    cloneDeep(templateVersion),
    "v1"
  ) as UsdmV4StudyVersion;
  v1.id = "ver-1";
  v1.versionIdentifier = "1.0";

  const v2 = namespaceUsdmSubtree(
    cloneDeep(templateVersion),
    "v2"
  ) as UsdmV4StudyVersion;
  v2.id = "ver-2";
  v2.versionIdentifier = "2.0";
  if (v2.studyIdentifiers[0]) {
    v2.studyIdentifiers[0].text = "SYNC-500";
  }
  const baseTitleType = v2.titles?.[0]?.type;
  if (baseTitleType) {
    v2.titles = [
      {
        id: "title-sync-500",
        text: "Synchronized Multi-Design Cardiovascular Trial",
        type: baseTitleType,
        instanceType: "StudyTitle",
      },
    ];
  }

  const templateDesign = v2.studyDesigns?.[0];
  if (!templateDesign) throw new Error("Expected v2 studyDesign");

  const d1 = namespaceUsdmSubtree(
    cloneDeep(templateDesign),
    "alpha"
  ) as UsdmV4InterventionalStudyDesign;
  d1.id = "design-alpha";
  d1.name = "Alpha Dose Escalation";

  const d2 = cloneDeep(templateDesign) as UsdmV4InterventionalStudyDesign;
  d2.id = "design-beta";
  d2.name = "Beta Pivotal Expansion";
  if (d2.arms[0]) {
    d2.arms[0].name = "Beta Active Regimen";
    d2.arms[0].label = "Beta Active Regimen";
  }

  v2.studyDesigns = [d1, d2];
  doc.study.versions = [v1, v2];
  return doc;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }
  if (typeof URL.createObjectURL !== "function") {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:synthetic-study"),
    });
  }
  if (typeof URL.revokeObjectURL !== "function") {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("cross-studio IndexedDB USDM study synchronization", () => {
  it("prompts for version/design on multi-design import and activates the study across all 4 studios and page reloads", async () => {
    const idb = new IDBFactory();
    const repo = createStudyRepositoryClient({ indexedDB: idb });

    const studioView = render(<StudyDesignGrid repository={repo} />);
    await screen.findByRole("table", {}, { timeout: 10_000 });

    const fileJson = JSON.stringify(buildMultiChoiceUsdm());
    const file = new File([fileJson], "sync-500.usdm.json", {
      type: "application/json",
    });
    const input = screen.getByTestId("study-repository-file-input");
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Version & design chooser modal appears.
    const dialogHeading = await screen.findByRole("heading", {
      name: "Choose study version and design",
    });
    expect(dialogHeading).toBeTruthy();
    const chooserDialog = screen.getByRole("dialog");

    fireEvent.change(within(chooserDialog).getByLabelText(/^Study version$/i), {
      target: { value: "ver-2" },
    });
    fireEvent.change(within(chooserDialog).getByLabelText(/^Study design$/i), {
      target: { value: "design-beta" },
    });
    fireEvent.click(
      within(chooserDialog).getByRole("button", {
        name: "Open selected design",
      })
    );

    // 1. /study-studio opens the chosen version and design immediately.
    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).getAllByRole("rowheader")[0]
          .textContent
      ).toContain("Beta Active Regimen");
    });
    studioView.unmount();

    // 2. Navigating to /crf loads the imported study automatically.
    const crfView = render(<CRFStudioContainer repository={repo} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("study-repository-revision").textContent
      ).toContain("R1");
      expect(
        (
          within(screen.getByTestId("study-repository-bar")).getByLabelText(
            "Active study"
          ) as HTMLSelectElement
        ).value
      ).toBe("sync-500");
    });
    crfView.unmount();

    // 3. Navigating to /study-data runs the pipeline on the imported study without manual handoff clicks.
    const dataView = renderStudyData(repo);
    await waitFor(
      () => {
        expect(screen.getAllByText(/SYNC-500/).length).toBeGreaterThan(0);
        expect(screen.getByText(/^Run \d+: 30 subjects/)).toBeTruthy();
      },
      { timeout: 30_000 }
    );
    dataView.unmount();

    // 4. Navigating to /clinical shows the imported study active, surviving a full reload.
    repo.dispose();
    const reloadedRepo = createStudyRepositoryClient({ indexedDB: idb });
    render(<StudyPicker repository={reloadedRepo} />);
    await waitFor(() => {
      expect(screen.getByTestId("study-picker-summary").textContent).toContain(
        "Synchronized Multi-Design Cardiovascular Trial"
      );
      expect(screen.getByTestId("study-picker-summary").textContent).toContain(
        "Revision R1"
      );
    });
    reloadedRepo.dispose();
  }, 45_000);

  it("loads edited study revisions automatically when navigating from /study-studio or /crf to /study-data and /clinical", async () => {
    const idb = new IDBFactory();
    const repo = createStudyRepositoryClient({ indexedDB: idb });

    // Select DEMO-301 in /study-studio and rename its first arm (R1 -> R2).
    const studioView = render(<StudyDesignGrid repository={repo} />);
    await screen.findByRole("table", {}, { timeout: 10_000 });
    fireEvent.change(screen.getByRole("combobox", { name: "Study" }), {
      target: { value: "DEMO-301" },
    });
    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).getAllByRole("rowheader")[0]
          .textContent
      ).toContain("Placebo");
    });

    fireEvent.click(
      within(
        within(screen.getByRole("table")).getAllByRole("rowheader")[0]
      ).getByRole("button")
    );
    const armPanel = screen.getByRole("region", { name: /^Edit arm / });
    fireEvent.change(
      within(armPanel).getByRole("textbox", { name: "Arm name" }),
      { target: { value: "Placebo Matched Capsule" } }
    );
    fireEvent.click(within(armPanel).getByRole("button", { name: "Rename" }));
    await screen.findByText("Draft saved in this browser.");
    expect(screen.getByText("Revision R2")).toBeTruthy();
    studioView.unmount();

    // Open /crf: loads DEMO-301 at R2, add a new protocol visit (R2 -> R3), and unmount.
    const crfView = render(<CRFStudioContainer repository={repo} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("study-repository-revision").textContent
      ).toContain("R2");
    });
    const addVisitButtons = screen.getAllByRole("button", { name: "Visit" });
    fireEvent.click(addVisitButtons[0]);
    crfView.unmount();

    // Mount /clinical: automatically reflects Revision R3 without manual clicks.
    const clinicalView = render(<StudyPicker repository={repo} />);
    await waitFor(() => {
      expect(screen.getByTestId("study-picker-summary").textContent).toContain(
        "Revision R3"
      );
    });
    clinicalView.unmount();

    // Mount /study-data: automatically tabulates Revision R3 with the renamed arm.
    const dataView = renderStudyData(repo);
    await waitFor(
      () => {
        expect(
          screen.getByTestId("study-repository-revision").textContent
        ).toContain("R3");
        expect(screen.getByText(/^Run \d+: 30 subjects/)).toBeTruthy();
      },
      { timeout: 30_000 }
    );
    fireEvent.click(screen.getByRole("tab", { name: "Study definition" }));
    expect(await screen.findByText(/Placebo Matched Capsule/)).toBeTruthy();
    dataView.unmount();
    repo.dispose();
  }, 45_000);

  it("surfaces a cross-tab reload banner via BroadcastChannel and blocks stale overwrites until resolved", async () => {
    const idb = new IDBFactory();
    const hub = new MemoryBroadcastHub();
    const clientA = createStudyRepositoryClient({
      indexedDB: idb,
      tabId: "tab-a",
      createChannel: hub.create,
    });
    const clientB = createStudyRepositoryClient({
      indexedDB: idb,
      tabId: "tab-b",
      createChannel: hub.create,
    });

    const view = render(
      <div>
        <section aria-label="Tab A">
          <StudyDesignGrid repository={clientA} />
        </section>
        <section aria-label="Tab B">
          <StudyDesignGrid repository={clientB} />
        </section>
      </div>
    );

    const tabA = within(screen.getByRole("region", { name: "Tab A" }));
    const tabB = within(screen.getByRole("region", { name: "Tab B" }));

    await tabA.findByRole("table", {}, { timeout: 10_000 });
    await tabB.findByRole("table", {}, { timeout: 10_000 });

    // Tab A renames the first arm and saves R2.
    fireEvent.click(
      within(within(tabA.getByRole("table")).getAllByRole("rowheader")[0]).getByRole(
        "button"
      )
    );
    const editArmA = tabA.getByRole("region", { name: /^Edit arm / });
    fireEvent.change(
      within(editArmA).getByRole("textbox", { name: "Arm name" }),
      { target: { value: "Tab A Saved Arm" } }
    );
    fireEvent.click(within(editArmA).getByRole("button", { name: "Rename" }));
    await tabA.findByText("Draft saved in this browser.");

    // Tab B receives the BroadcastChannel notification and displays the reload banner.
    const reloadBanner = await tabB.findByTestId(
      "study-repository-reload-banner"
    );
    expect(reloadBanner.textContent).toContain("R2");

    // Attempting an edit in Tab B before reloading triggers StudyConflictModal instead of overwriting R2.
    fireEvent.click(
      within(within(tabB.getByRole("table")).getAllByRole("rowheader")[0]).getByRole(
        "button"
      )
    );
    const editArmB = tabB.getByRole("region", { name: /^Edit arm / });
    fireEvent.change(
      within(editArmB).getByRole("textbox", { name: "Arm name" }),
      { target: { value: "Stale Tab B Arm" } }
    );
    fireEvent.click(within(editArmB).getByRole("button", { name: "Rename" }));

    const conflictHeading = await screen.findByRole("heading", {
      name: "Newer study revision saved in another tab",
    });
    expect(conflictHeading).toBeTruthy();

    // Verify IndexedDB still holds Tab A's R2 untouched.
    const storedBeforeResolve = await clientA.getRecord("tavr-savr");
    expect(storedBeforeResolve?.workspace.revision.id).toBe("R2");
    expect(
      storedBeforeResolve?.workspace.usdm.study.versions?.[0]?.studyDesigns?.[0]
        ?.arms?.[0]?.name
    ).toBe("Tab A Saved Arm");

    // Resolve by loading R2 into Tab B.
    fireEvent.click(screen.getByRole("button", { name: "Load R2" }));
    await waitFor(() => {
      expect(
        within(tabB.getByRole("table")).getAllByRole("rowheader")[0].textContent
      ).toContain("Tab A Saved Arm");
      expect(tabB.getByText("Revision R2")).toBeTruthy();
    });

    view.unmount();
    clientA.dispose();
    clientB.dispose();
  });

  it("falls back to volatile in-memory state with .usdm.json and .study.json downloads when IndexedDB is blocked", async () => {
    const blockedIdb: Pick<IDBFactory, "open"> = {
      open: () => {
        throw new DOMException(
          "IndexedDB blocked in private mode",
          "SecurityError"
        );
      },
    };
    const volatileRepo = createStudyRepositoryClient({
      indexedDB: blockedIdb as IDBFactory,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<StudyDesignGrid repository={volatileRepo} />);
    await screen.findByRole("table", {}, { timeout: 10_000 });

    const notice = await screen.findByTestId("study-repository-volatile-notice");
    expect(notice.textContent).toContain(
      "Browser IndexedDB storage is unavailable"
    );

    const usdmBtn = screen.getByRole("button", {
      name: "Export USDM (.usdm.json)",
    });
    const wsBtn = screen.getByRole("button", {
      name: "Export workspace (.study.json)",
    });
    expect((usdmBtn as HTMLButtonElement).disabled).toBe(false);
    expect((wsBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(usdmBtn);
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(wsBtn);
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(2));

    volatileRepo.dispose();
  });
});
