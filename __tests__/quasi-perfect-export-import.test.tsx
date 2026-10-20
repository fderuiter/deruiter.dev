// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFile, sanitizeFilename } from "@/lib/download";
import {
  MAX_CUSTOM_THEOREMS,
  deleteCustomTheorem,
  exportCustomTheorems,
  importCustomTheorems,
  parseCustomTheorems,
  saveCustomTheorem,
  type CustomTheorem,
} from "@/lib/quasi-perfect/sandbox";
import { puzzleLevels, type LevelScore } from "@/lib/quasi-perfect";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { LeanIdeInspector } from "@/components/QuasiPerfectPuzzler/LeanIdeInspector";
import { SandboxMode } from "@/components/QuasiPerfectPuzzler/SandboxMode";

vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadFile: vi.fn(() => true),
}));
vi.mock("@/components/ui/CopyButton", () => ({ CopyButton: () => null }));

const STORAGE_KEY = "quasi_perfect_puzzler_custom_theorems_v1";
const level = puzzleLevels[0];

const theorem = (over: Partial<CustomTheorem> = {}): CustomTheorem => ({
  id: "t-1",
  title: "Reflexivity",
  formula: "x = x",
  hypotheses: "",
  ...over,
});

const fullCollection = (): CustomTheorem[] =>
  Array.from({ length: MAX_CUSTOM_THEOREMS }, (_, i) =>
    theorem({ id: `t-${i}`, title: `T${i}`, formula: `a + ${i} = ${i} + a` })
  );

const score: LevelScore = {
  levelId: level.id,
  completed: true,
  usedSorry: false,
  remainingRam: 20,
  stars: 3,
  morality: 100,
  timestamp: 1,
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(downloadFile).mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("sanitizeFilename", () => {
  it("keeps safe characters and collapses the rest into single underscores", () => {
    expect(sanitizeFilename("add_zero.v2-final", "x")).toBe(
      "add_zero.v2-final"
    );
    expect(sanitizeFilename("Binomial Expansion (a + b)²", "x")).toBe(
      "Binomial_Expansion_a_b_2"
    );
    expect(sanitizeFilename("Théorème: égalité", "x")).toBe("Theoreme_egalite");
  });

  it("never yields a hidden or empty name", () => {
    expect(sanitizeFilename("../.secret", "x")).toBe("secret");
    expect(sanitizeFilename("  ///  ", "proof")).toBe("proof");
    expect(sanitizeFilename("", "proof")).toBe("proof");
  });
});

describe("saveCustomTheorem", () => {
  it("adds a parsed theorem with a fresh id and falls back to the formula as title", () => {
    const result = saveCustomTheorem([], {
      title: "  ",
      formula: " x = x ",
      hypotheses: "",
    });
    expect(result.saved).toBe(true);
    expect(result.theorems).toHaveLength(1);
    expect(result.theorems[0]).toMatchObject({
      title: "x = x",
      formula: "x = x",
    });
    expect(result.theorems[0].id).toMatch(/^custom-theorem-/);
  });

  it("refuses a save past the cap", () => {
    const full = fullCollection();
    const result = saveCustomTheorem(full, {
      title: "One more",
      formula: "y = y",
      hypotheses: "",
    });
    expect(result.saved).toBe(false);
    expect(result.message).toMatch(/full \(50 theorems\)/);
    expect(result.theorems).toEqual(full);
  });

  it("treats an exact duplicate, after trimming, as a no-op with a message", () => {
    const existing = [theorem({ hypotheses: "h: x = y" })];
    const result = saveCustomTheorem(existing, {
      title: "Another name",
      formula: "  x = x",
      hypotheses: "h: x = y  ",
    });
    expect(result.saved).toBe(false);
    expect(result.message).toBe(
      'Already saved as "Reflexivity". Nothing changed.'
    );
    expect(result.theorems).toEqual(existing);
  });

  it("rejects a formula that does not parse", () => {
    const result = saveCustomTheorem([], {
      title: "Broken",
      formula: "a + * b",
      hypotheses: "",
    });
    expect(result.saved).toBe(false);
    expect(result.message).toMatch(/^Not saved\. The goal formula/);
  });

  it("deletes by id", () => {
    const kept = theorem({ id: "keep", formula: "y = y" });
    expect(deleteCustomTheorem([theorem(), kept], "t-1")).toEqual([kept]);
  });
});

describe("importCustomTheorems", () => {
  it("assigns fresh ids and skips duplicates of saved and earlier entries", () => {
    const existing = [theorem()];
    const json = JSON.stringify({
      version: 1,
      theorems: [
        { id: "t-1", title: "Reflexivity copy", formula: " x = x " },
        {
          id: "t-1",
          title: "Transitivity",
          formula: "a = c",
          hypotheses: "h1: a = b, h2: b = c",
        },
        {
          id: "evil",
          title: "Again",
          formula: "a = c",
          hypotheses: "h1: a = b, h2: b = c",
        },
      ],
    });
    const result = importCustomTheorems(existing, json);

    expect(result.error).toBeUndefined();
    expect(result.imported).toBe(1);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatch(/Entry 1 skipped: .*already saved/);
    expect(result.warnings[1]).toMatch(/Entry 3 skipped: .*already saved/);

    const added = result.theorems[1];
    expect(added.title).toBe("Transitivity");
    expect(added.id).not.toBe("t-1");
    expect(added.id).toMatch(/^custom-theorem-/);
    expect(new Set(result.theorems.map((t) => t.id)).size).toBe(2);
  });

  it("reports a file that is not JSON or has no theorems array", () => {
    expect(importCustomTheorems([], "{not json").error).toBe(
      "The file is not valid JSON."
    );
    expect(importCustomTheorems([], '{"version":1}').error).toBe(
      "The file has no theorems array."
    );
  });

  it("skips entries whose formula or hypotheses do not parse", () => {
    const result = importCustomTheorems(
      [],
      JSON.stringify([
        { title: "Broken", formula: "a + * b" },
        { title: "Bad hyps", formula: "a = b", hypotheses: "h1: (a" },
        "not an object",
        { title: "Fine", formula: "x = x" },
      ])
    );
    expect(result.imported).toBe(1);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toMatch(/Entry 1 skipped: The goal formula/);
    expect(result.warnings[1]).toMatch(/Entry 2 skipped: The hypotheses/);
    expect(result.warnings[2]).toMatch(/Entry 3 skipped: not a theorem/);
  });

  it("stops at the cap and warns for each entry left out", () => {
    const full = fullCollection().slice(1);
    const result = importCustomTheorems(
      full,
      JSON.stringify([
        { formula: "p = p" },
        { formula: "q = q" },
        { formula: "r = r" },
      ])
    );
    expect(result.theorems).toHaveLength(MAX_CUSTOM_THEOREMS);
    expect(result.imported).toBe(1);
    expect(result.warnings).toHaveLength(2);
  });

  it("round-trips an export without carrying ids", () => {
    const exported = exportCustomTheorems([theorem()]);
    expect(exported).not.toContain('"id"');
    const result = importCustomTheorems([], exported);
    expect(result.theorems).toHaveLength(1);
    expect(result.theorems[0]).toMatchObject({
      title: "Reflexivity",
      formula: "x = x",
    });
  });
});

describe("parseCustomTheorems", () => {
  it("drops malformed storage and caps the list", () => {
    expect(parseCustomTheorems("{bad")).toEqual([]);
    expect(parseCustomTheorems('{"a":1}')).toEqual([]);
    expect(parseCustomTheorems(JSON.stringify([{ formula: "x = x" }]))).toEqual(
      []
    );
    const tooMany = [...fullCollection(), theorem({ id: "extra" })];
    expect(parseCustomTheorems(JSON.stringify(tooMany))).toHaveLength(
      MAX_CUSTOM_THEOREMS
    );
  });
});

describe("Download .lean in the victory card", () => {
  it("names the file after the Lean theorem name", () => {
    render(
      <VictoryModal
        score={score}
        level={level}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={0}
        leanCode="theorem demo : 1 = 1 := by rfl"
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    expect(
      screen.getByText("Generated Lean 4 Text · Not Compiled")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download .lean" }));
    expect(downloadFile).toHaveBeenCalledWith(
      "theorem demo : 1 = 1 := by rfl",
      `${sanitizeFilename(level.leanTheoremName, "")}.lean`
    );
  });

  it("falls back to the title, then to proof", () => {
    const { rerender } = render(
      <VictoryModal
        score={score}
        level={{ ...level, leanTheoremName: "", title: "My Level" }}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={0}
        leanCode="-- lean"
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Download .lean" }));
    expect(downloadFile).toHaveBeenLastCalledWith("-- lean", "My_Level.lean");

    rerender(
      <VictoryModal
        score={score}
        level={{ ...level, leanTheoremName: "", title: "" }}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={0}
        leanCode="-- lean"
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Download .lean" }));
    expect(downloadFile).toHaveBeenLastCalledWith("-- lean", "proof.lean");
  });
});

describe("Lean inspector exports", () => {
  it("downloads the Lean text and a step log with a browserCheck block", () => {
    render(<LeanIdeInspector level={level} steps={[]} isComplete={false} />);
    const stem = sanitizeFilename(level.leanTheoremName, "");

    fireEvent.click(screen.getByRole("button", { name: "Download .lean" }));
    expect(downloadFile).toHaveBeenLastCalledWith(
      expect.stringContaining(`theorem ${level.leanTheoremName}`),
      `${stem}.lean`
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Export step log (.json)" })
    );
    const [payload, filename, options] = vi.mocked(downloadFile).mock.lastCall!;
    expect(filename).toBe(`${stem}_steplog.json`);
    expect(options).toEqual({ mimeType: "application/json" });
    const log = JSON.parse(String(payload));
    expect(Object.keys(log.browserCheck).sort()).toEqual(
      ["diagnostics", "engine", "goalState", "status", "success"].sort()
    );
    expect(JSON.stringify(log)).not.toMatch(/kernel/i);
  });
});

describe("Sandbox saved theorems", () => {
  const openDrawer = () => {
    render(<SandboxMode />);
    fireEvent.click(
      screen.getByRole("button", { name: /custom formula input/i })
    );
  };

  it("starts with an empty title input and a placeholder", () => {
    openDrawer();
    const title = screen.getByLabelText(/theorem title/i) as HTMLInputElement;
    expect(title.value).toBe("");
    expect(title.placeholder).toBe("Defaults to the goal formula");
  });

  it("saves to storage, announces it, and says so when saving a duplicate", () => {
    openDrawer();
    fireEvent.change(screen.getByLabelText(/theorem title/i), {
      target: { value: "Binomial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save theorem" }));

    const [saveStatus] = screen.getAllByRole("status");
    expect(saveStatus.textContent).toBe('Saved "Binomial".');
    expect(parseCustomTheorems(localStorage.getItem(STORAGE_KEY))).toHaveLength(
      1
    );
    expect(screen.getByText("Saved theorems (1/50)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save theorem" }));
    expect(saveStatus.textContent).toBe(
      'Already saved as "Binomial". Nothing changed.'
    );
    expect(parseCustomTheorems(localStorage.getItem(STORAGE_KEY))).toHaveLength(
      1
    );
  });

  it("loads and deletes a saved theorem", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([theorem({ title: "Stored" })])
    );
    openDrawer();
    const item = screen.getByText("Stored", { selector: "p" }).closest("li")!;

    fireEvent.click(within(item).getByRole("button", { name: "Load Stored" }));
    expect(screen.getByText("Custom: Stored")).toBeTruthy();
    expect(
      (screen.getByLabelText(/theorem title/i) as HTMLInputElement).value
    ).toBe("Stored");

    fireEvent.click(
      within(item).getByRole("button", { name: "Delete Stored" })
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
    expect(screen.queryByText("Stored")).toBeNull();
  });

  it("exports every saved theorem through downloadFile", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([theorem()]));
    openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Export all (.json)" }));
    expect(downloadFile).toHaveBeenCalledWith(
      exportCustomTheorems([theorem()]),
      "custom_theorems.json",
      { mimeType: "application/json" }
    );
  });

  it("imports a file and announces the count with skipped warnings", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([theorem()]));
    openDrawer();
    const file = new File(
      [
        JSON.stringify([
          { formula: "x = x" },
          { title: "New", formula: "y = y" },
          { formula: "a + * b" },
        ]),
      ],
      "theorems.json",
      { type: "application/json" }
    );
    fireEvent.change(screen.getByTestId("custom-theorems-import-input"), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(
        "Imported 1 theorem; 2 skipped with warnings, listed in the log."
      )
    ).toBeTruthy();
    expect(screen.getAllByRole("status")[1].textContent).toMatch(/^Imported 1/);
    expect(parseCustomTheorems(localStorage.getItem(STORAGE_KEY))).toHaveLength(
      2
    );
  });

  it("announces a file that is not JSON", async () => {
    openDrawer();
    fireEvent.change(screen.getByTestId("custom-theorems-import-input"), {
      target: { files: [new File(["{oops"], "bad.json")] },
    });
    expect(
      await screen.findByText("Import failed. The file is not valid JSON.")
    ).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
