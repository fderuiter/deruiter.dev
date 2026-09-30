// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { RunChoiceBadges } from "@/components/trial-and-error/RunChoiceBadges";
import { CODEX_KEY } from "@/components/trial-and-error/useCodex";
import {
  ACT_I,
  emptyCodex,
  parseCodex,
  serializeCodex,
  type Act,
  type Unlocks,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));
const copyToClipboard = vi.fn<(text: string) => Promise<void>>();
vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: (text: string) => copyToClipboard(text),
  getActiveHostUrl: () => "https://deruiter.dev",
}));

/** The standard in-memory Storage (AGENTS.md §1). */
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const original = Object.getOwnPropertyDescriptor(window, "localStorage");
const act1: Act = { ...ACT_I, crisisDeck: undefined };
let storage: MockStorage;

beforeEach(() => {
  announce.mockClear();
  copyToClipboard.mockReset();
  copyToClipboard.mockResolvedValue(undefined);
  storage = new MockStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  if (original) Object.defineProperty(window, "localStorage", original);
});

function storeUnlocks(unlocks: Unlocks) {
  storage.setItem(CODEX_KEY, serializeCodex({ ...emptyCodex(), unlocks }));
}

function openRunInfo() {
  fireEvent.click(screen.getByTestId("run-info-button"));
  return screen.getByRole("dialog", { name: "Run Info" });
}

function openNewRun() {
  fireEvent.click(within(openRunInfo()).getByTestId("run-info-new-run"));
  return screen.getByRole("dialog", { name: "New run" });
}

const sponsorGroup = (dialog: HTMLElement) =>
  within(dialog).getByRole("group", { name: "Sponsor" });
const stakeGroup = (dialog: HTMLElement) =>
  within(dialog).getByRole("group", { name: "Stake: GCP audit level" });

const badges = () =>
  within(screen.getByRole("complementary", { name: "Blind" }));

describe("the sponsor and stake picker (#950)", () => {
  it("offers only Virtual Biotech at stake 1 on a first visit, with every locked option explained", () => {
    render(<CardTable act={act1} seed="first" persist />);
    const dialog = openNewRun();
    const sponsors = within(sponsorGroup(dialog)).getAllByRole("radio");
    expect(sponsors).toHaveLength(4);
    // One radio group: a shared name gives arrow-key movement between them.
    expect(new Set(sponsors.map((r) => r.getAttribute("name"))).size).toBe(1);
    const [virtual, ...locked] = sponsors as HTMLInputElement[];
    expect(virtual.checked).toBe(true);
    expect(virtual.disabled).toBe(false);
    expect(locked.every((r) => r.disabled)).toBe(true);

    // Each locked option says how to unlock it, as its description.
    const oncology = within(sponsorGroup(dialog)).getByRole("radio", {
      name: /Oncology Pharma/,
    });
    const reason = document.getElementById(
      oncology.getAttribute("aria-describedby")!
    )!;
    expect(reason.textContent).toBe(
      "Locked. Win a run with Virtual Biotech to unlock."
    );
    expect(
      within(sponsorGroup(dialog)).getAllByTestId("locked-reason")
    ).toHaveLength(3);

    const stakes = within(stakeGroup(dialog)).getAllByRole(
      "radio"
    ) as HTMLInputElement[];
    expect(stakes.map((r) => r.disabled)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(
      document.getElementById(stakes[1].getAttribute("aria-describedby")!)!
        .textContent
    ).toBe(
      "Locked. Win at stake 1 (Routine Monitoring) with Virtual Biotech to unlock."
    );
  });

  it("starts an unlocked sponsor and stake, badged in the Blind panel and Run Info, and resumes it after a reload", () => {
    storeUnlocks({ VIRTUAL_BIOTECH: 2, ONCOLOGY_PHARMA: 2 });
    const first = render(<CardTable act={act1} seed="first" persist />);
    expect(badges().getByTestId("sponsor-badge").textContent).toContain(
      "Virtual Biotech"
    );
    const dialog = openNewRun();
    fireEvent.click(
      within(sponsorGroup(dialog)).getByRole("radio", {
        name: /Oncology Pharma/,
      })
    );
    fireEvent.click(
      within(stakeGroup(dialog)).getByRole("radio", { name: /Sponsor Audit/ })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    expect(screen.queryByTestId("new-run")).toBeNull();

    expect(badges().getByTestId("sponsor-badge").textContent).toBe(
      "Sponsor: Oncology Pharma"
    );
    expect(badges().getByTestId("stake-badge").textContent).toBe(
      "Stake 2: Sponsor Audit"
    );
    const info = openRunInfo();
    expect(
      within(info).getByTestId("sponsor-badge").getAttribute("data-sponsor")
    ).toBe("ONCOLOGY_PHARMA");
    expect(
      within(info).getByTestId("stake-badge").getAttribute("data-stake")
    ).toBe("2");
    fireEvent.click(within(info).getByRole("button", { name: /Close/ }));

    // The Codex records the sponsor as discovered.
    expect(
      parseCodex(storage.getItem(CODEX_KEY)).codex.discovered.SPONSOR
    ).toHaveProperty("ONCOLOGY_PHARMA");

    // One move saves the run, with its sponsor and stake.
    fireEvent.click(
      document.querySelector<HTMLButtonElement>("[data-card-id]")!
    );
    const key = Array.from({ length: storage.length }, (_, i) =>
      storage.key(i)
    ).find((k) => k?.startsWith("te:run-save:"))!;
    const saved = JSON.parse(storage.getItem(key)!);
    expect(saved.sponsorId).toBe("ONCOLOGY_PHARMA");
    expect(saved.stake).toBe(2);
    first.unmount();

    render(<CardTable act={act1} seed="other" persist />);
    fireEvent.click(screen.getByRole("button", { name: "Resume run" }));
    expect(badges().getByTestId("sponsor-badge").textContent).toContain(
      "Oncology Pharma"
    );
    expect(badges().getByTestId("stake-badge").getAttribute("data-stake")).toBe(
      "2"
    );
  });

  it("carries a non-default sponsor and stake in the challenge link", async () => {
    storeUnlocks({ VIRTUAL_BIOTECH: 3 });
    render(<CardTable act={act1} seed="first" persist />);
    const dialog = openNewRun();
    fireEvent.change(within(dialog).getByTestId("new-run-seed"), {
      target: { value: "7K3M-Q9PX" },
    });
    fireEvent.click(
      within(stakeGroup(dialog)).getByRole("radio", { name: /For-Cause/ })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    const info = openRunInfo();
    fireEvent.click(
      within(info).getByRole("button", { name: "Copy challenge link" })
    );
    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenLastCalledWith(
        "https://deruiter.dev/arcade/trial-and-error#seed=7K3M-Q9PX&stake=3"
      )
    );
  });

  it("keeps the stake when switching to a sponsor that has it, and lowers it otherwise", () => {
    storeUnlocks({ VIRTUAL_BIOTECH: 3, ONCOLOGY_PHARMA: 1 });
    render(<CardTable act={act1} seed="first" persist />);
    const dialog = openNewRun();
    const stakeRadio = (name: RegExp) =>
      within(stakeGroup(dialog)).getByRole<HTMLInputElement>("radio", { name });
    fireEvent.click(stakeRadio(/For-Cause/));
    expect(stakeRadio(/For-Cause/).checked).toBe(true);
    fireEvent.click(
      within(sponsorGroup(dialog)).getByRole("radio", {
        name: /Oncology Pharma/,
      })
    );
    expect(stakeRadio(/Routine Monitoring/).checked).toBe(true);
    expect(stakeRadio(/For-Cause/).disabled).toBe(true);
  });

  it("plays a challenge link's locked sponsor and stake, marked as from the link", () => {
    window.history.replaceState(
      null,
      "",
      "/arcade/trial-and-error#seed=7K3M-Q9PX&sponsor=CARDIO_MEGA_TRIAL&stake=2"
    );
    render(<CardTable act={act1} persist />);
    const dialog = screen.getByRole("dialog", { name: "New run" });
    const cardio = within(sponsorGroup(dialog)).getByRole<HTMLInputElement>(
      "radio",
      { name: /Cardio Mega-Trial/ }
    );
    expect(cardio.checked).toBe(true);
    expect(cardio.disabled).toBe(false);
    const stake = within(stakeGroup(dialog)).getByRole<HTMLInputElement>(
      "radio",
      { name: /Sponsor Audit/ }
    );
    expect(stake.checked).toBe(true);
    expect(stake.disabled).toBe(false);
    expect(
      within(dialog).getAllByTestId("challenge-choice-note").length
    ).toBeGreaterThan(0);
    expect(dialog.textContent).toContain("From a challenge link");
    // Other locked sponsors stay locked.
    expect(
      within(sponsorGroup(dialog)).getByRole<HTMLInputElement>("radio", {
        name: /Oncology Pharma/,
      }).disabled
    ).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    expect(badges().getByTestId("sponsor-badge").textContent).toContain(
      "Cardio Mega-Trial"
    );
    expect(badges().getByTestId("stake-badge").getAttribute("data-stake")).toBe(
      "2"
    );
  });

  it("falls back to the defaults for a link with an unknown sponsor or stake", () => {
    window.history.replaceState(
      null,
      "",
      "/#seed=7K3M-Q9PX&sponsor=GENERIC_CRO&stake=9"
    );
    render(<CardTable act={act1} persist />);
    const dialog = screen.getByRole("dialog", { name: "New run" });
    expect(
      within(sponsorGroup(dialog)).getByRole<HTMLInputElement>("radio", {
        name: /Virtual Biotech/,
      }).checked
    ).toBe(true);
    expect(within(dialog).queryByTestId("challenge-choice-note")).toBeNull();
  });

  it("keeps the Daily Protocol on Virtual Biotech at stake 1", () => {
    storeUnlocks({ VIRTUAL_BIOTECH: 3, ONCOLOGY_PHARMA: 1 });
    render(<CardTable act={act1} seed="first" persist />);
    const dialog = openNewRun();
    fireEvent.click(
      within(sponsorGroup(dialog)).getByRole("radio", {
        name: /Oncology Pharma/,
      })
    );
    fireEvent.click(within(dialog).getByRole("radio", { name: /Daily/ }));
    const group = sponsorGroup(dialog) as HTMLFieldSetElement;
    expect(group.disabled).toBe(true);
    expect(
      within(dialog).getByTestId("daily-choice-note").textContent
    ).toContain("always Virtual Biotech at stake 1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    expect(badges().getByTestId("sponsor-badge").textContent).toContain(
      "Virtual Biotech"
    );
    expect(badges().getByTestId("stake-badge").getAttribute("data-stake")).toBe(
      "1"
    );
  });

  it("offers only the defaults when storage is unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: undefined,
    });
    render(<CardTable act={act1} seed="first" persist />);
    const dialog = openNewRun();
    const enabled = within(dialog)
      .getAllByRole<HTMLInputElement>("radio")
      .filter((r) => r.name.endsWith("-sponsor") || r.name.endsWith("-stake"))
      .filter((r) => !r.disabled);
    expect(enabled.map((r) => r.value)).toEqual(["VIRTUAL_BIOTECH", "1"]);
  });

  it("pre-selects the current run's sponsor when New Run reopens", () => {
    storeUnlocks({ VIRTUAL_BIOTECH: 2, ONCOLOGY_PHARMA: 1 });
    render(<CardTable act={act1} seed="first" persist />);
    const dialog = openNewRun();
    fireEvent.click(
      within(sponsorGroup(dialog)).getByRole("radio", {
        name: /Oncology Pharma/,
      })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    // Reopening pre-selects the run's own choice.
    const again = openNewRun();
    expect(
      within(sponsorGroup(again)).getByRole<HTMLInputElement>("radio", {
        name: /Oncology Pharma/,
      }).checked
    ).toBe(true);
  });
});

describe("RunChoiceBadges", () => {
  it("names the sponsor for screen readers and marks a raised stake", () => {
    render(
      <RunChoiceBadges
        choice={{ sponsorId: "RARE_DISEASE_BIOTECH", stake: 5 }}
      />
    );
    expect(screen.getByTestId("sponsor-badge").textContent).toBe(
      "Sponsor: Rare Disease Biotech"
    );
    const stake = screen.getByTestId("stake-badge");
    expect(stake.textContent).toBe("Stake 5: Form 483 Issued");
    expect(stake.className).toContain("amber");
    expect(stake.getAttribute("title")).toContain("relic slot");
  });
});
