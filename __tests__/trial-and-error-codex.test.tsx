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
import { Codex } from "@/components/trial-and-error/Codex";
import { CODEX_KEY } from "@/components/trial-and-error/useCodex";
import {
  ACT_I,
  BIOSTAT_OPS_CAMPAIGN,
  DOSE_ESCALATION_SCENARIO,
  RUN_HISTORY_LIMIT,
  emptyCodex,
  parseCodex,
  type Act,
  type Codex as CodexDocument,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
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

const act: Act = { ...ACT_I, crisisDeck: undefined };
let storage: MockStorage;
const original = Object.getOwnPropertyDescriptor(window, "localStorage");
const useStorage = (value: unknown) =>
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value,
  });

beforeEach(() => {
  announce.mockClear();
  window.history.replaceState(null, "", "/");
  storage = new MockStorage();
  useStorage(storage);
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
  if (original) Object.defineProperty(window, "localStorage", original);
});

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const codexDialog = () => screen.queryByRole("dialog", { name: "Codex" });

/** One relic and one sponsor discovered, and one finished Daily run. */
function sampleCodex(): CodexDocument {
  const codex = emptyCodex();
  const relicId = BIOSTAT_OPS_CAMPAIGN.acts[0].shop!.entries.find(
    (e) => e.kind === "RELIC"
  )!;
  if (relicId.kind !== "RELIC") throw new Error("no relic");
  codex.discovered.RELIC[relicId.relic.id] = {
    firstSeen: { actId: "biostat-ops", seed: "7K3M-Q9PX" },
    via: "SHOP",
  };
  codex.discovered.SPONSOR.VIRTUAL_BIOTECH = {
    firstSeen: {
      actId: "biostat-ops",
      seed: "AB12-CD34",
      origin: { kind: "DAILY", date: "2026-09-30" },
    },
    via: "SPONSOR",
  };
  codex.history = [
    {
      actId: "biostat-ops",
      seed: "AB12-CD34",
      origin: { kind: "DAILY", date: "2026-09-30" },
      reached: {
        actIndex: 1,
        actTitle: "Act II",
        blindIndex: 2,
        blindTitle: "DMC Milestone",
        round: null,
      },
      bestHand: { handType: "TLF_PAIR", score: 1240 },
      result: "FAILED",
      campaignWon: false,
      moves: 88,
      endedOn: "2026-09-30",
    },
  ];
  return codex;
}

describe("the Codex view", () => {
  it("silhouettes undiscovered entries and shows discovered ones in full", () => {
    const codex = sampleCodex();
    render(
      <Codex plan={BIOSTAT_OPS_CAMPAIGN} codex={codex} onClose={() => {}} />
    );
    const dialog = codexDialog()!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const entries = within(dialog).getAllByTestId("codex-entry");
    const found = entries.filter(
      (e) => e.getAttribute("data-discovered") === "true"
    );
    const hidden = entries.filter(
      (e) => e.getAttribute("data-discovered") === "false"
    );
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toContain("First seen on seed 7K3M-Q9PX");
    expect(found[0].textContent).toContain("Seen in the Procurement Shop");
    expect(hidden.length).toBeGreaterThan(0);
    for (const entry of hidden) {
      expect(entry.textContent).toContain("Undiscovered");
      // A silhouette never names the entry.
      for (const other of found) {
        const name = other.querySelector("p")!.textContent!;
        expect(entry.textContent).not.toContain(name);
      }
    }
  });

  it("switches sections with arrow keys, Home and End, and shows run history", () => {
    render(
      <Codex
        plan={BIOSTAT_OPS_CAMPAIGN}
        codex={sampleCodex()}
        onClose={() => {}}
      />
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(8);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[7]);
    fireEvent.keyDown(tabs[7], { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: "End" });
    const history = tabs[7];
    expect(history.textContent).toBe("Run history");
    expect(history.getAttribute("aria-selected")).toBe("true");
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(history.id);
    const items = within(panel).getAllByTestId("codex-history-entry");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Act II · DMC Milestone");
    expect(items[0].textContent).toContain("Best hand: TLF Pair, 1,240");
    expect(
      within(items[0]).getByTestId("codex-history-marker").textContent
    ).toBe("Daily Protocol 2026-09-30");
    expect(panel.textContent).toContain(`The last ${RUN_HISTORY_LIMIT} runs`);
  });

  it("says so when no run has finished", () => {
    render(
      <Codex
        plan={BIOSTAT_OPS_CAMPAIGN}
        codex={emptyCodex()}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Run history" }));
    expect(screen.getByRole("tabpanel").textContent).toContain(
      "No finished runs yet"
    );
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Codex
        plan={BIOSTAT_OPS_CAMPAIGN}
        codex={emptyCodex()}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the Codex on the Card Table", () => {
  /** Opens Run Info, then the Codex from it. */
  function openCodex() {
    const button = screen.getByTestId("run-info-button");
    button.focus();
    fireEvent.click(button);
    // A real click focuses the button it lands on, which closes with Run Info.
    const codexButton = screen.getByTestId("run-info-codex");
    codexButton.focus();
    fireEvent.click(codexButton);
    return button;
  }

  it("discovers a played hand, keeps it across a reload and restores focus", async () => {
    const first = render(<CardTable act={act} seed="codex-ui" persist />);
    fireEvent.click(card("C-T14.1.1-A"));
    fireEvent.click(card("C-L16.2.4"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    const stored = parseCodex(storage.getItem(CODEX_KEY));
    expect(stored.status).toBe("OK");
    expect(Object.keys(stored.codex.discovered.HAND)).toHaveLength(1);
    expect(stored.codex.discovered.SPONSOR.VIRTUAL_BIOTECH.firstSeen.seed).toBe(
      "codex-ui"
    );
    first.unmount();

    // The reload: a new run on another seed still shows the discovery.
    storage.removeItem(`te:run-save:${act.id}`);
    render(<CardTable act={act} seed="codex-reload" persist />);
    const trigger = openCodex();
    const dialog = codexDialog()!;
    expect(screen.queryByRole("dialog", { name: "Run Info" })).toBeNull();
    fireEvent.click(within(dialog).getByTestId("codex-tab-HAND"));
    const discovered = within(dialog)
      .getAllByTestId("codex-entry")
      .filter((e) => e.getAttribute("data-discovered") === "true");
    expect(discovered).toHaveLength(1);
    expect(discovered[0].textContent).toContain("First seen on seed codex-ui");
    within(dialog).getByTestId("codex-tab-HAND").focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(codexDialog()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("records a finished run in the history, offered from the end screen", () => {
    render(
      <CardTable scenario={DOSE_ESCALATION_SCENARIO} seed="lost" persist />
    );
    for (let i = 0; i < 9; i++) {
      const first = document.querySelector<HTMLButtonElement>("[data-card-id]");
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    }
    const result = screen.getByTestId("blind-result");
    const history = parseCodex(storage.getItem(CODEX_KEY)).codex.history;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ seed: "lost", result: "FAILED" });
    fireEvent.click(within(result).getByTestId("end-codex"));
    fireEvent.click(screen.getByRole("tab", { name: "Run history" }));
    expect(screen.getAllByTestId("codex-history-entry")).toHaveLength(1);
  });

  it("works without storage: no Codex is kept and nothing throws", () => {
    useStorage(undefined);
    render(<CardTable act={act} seed="no-storage" persist />);
    fireEvent.click(card("C-T14.1.1-A"));
    fireEvent.click(card("C-L16.2.4"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    openCodex();
    const dialog = codexDialog()!;
    expect(
      within(dialog)
        .getAllByTestId("codex-entry")
        .every((e) => e.getAttribute("data-discovered") === "false")
    ).toBe(true);
  });

  it("is hidden on the guided Blind and on tables that do not persist", () => {
    render(
      <CardTable
        act={act}
        seed="guided"
        persist
        endAction={() => ({ label: "Start the campaign", onSelect: () => {} })}
      />
    );
    fireEvent.click(screen.getByTestId("run-info-button"));
    expect(screen.queryByTestId("run-info-codex")).toBeNull();
    expect(storage.getItem(CODEX_KEY)).toBeNull();
    cleanup();
    render(<CardTable act={act} seed="embedded" />);
    fireEvent.click(screen.getByTestId("run-info-button"));
    expect(screen.queryByTestId("run-info-codex")).toBeNull();
  });
});
