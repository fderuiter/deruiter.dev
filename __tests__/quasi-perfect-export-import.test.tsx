// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { LeanIdeInspector } from "@/components/QuasiPerfectPuzzler/LeanIdeInspector";
import { SandboxMode } from "@/components/QuasiPerfectPuzzler/SandboxMode";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";
import {
  sanitizeFilename,
  getSavedCustomTheorems,
  saveCustomTheorem,
  deleteCustomTheorem,
  importCustomTheorems,
} from "@/lib/quasi-perfect/sandbox";
import * as downloadModule from "@/lib/download";

vi.mock("@/lib/download", async (importOriginal) => {
  const actual = await importOriginal<typeof downloadModule>();
  return {
    ...actual,
    downloadFile: vi.fn().mockReturnValue(true),
  };
});

describe("Filename Sanitization Helper", () => {
  it("sanitizes level titles and theorem names into valid filenames", () => {
    expect(sanitizeFilename("Binomial Expansion (a + b)²")).toBe(
      "binomial_expansion_a_b_2"
    );
    expect(sanitizeFilename("Equality & Transitivity 100%!")).toBe(
      "equality_transitivity_100"
    );
    expect(sanitizeFilename("   ///  hello---world___  ")).toBe(
      "hello---world"
    );
    expect(sanitizeFilename("", "default_theorem")).toBe("default_theorem");
  });
});

describe("VictoryModal Export Action", () => {
  const sampleLevel = puzzleLevels[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Download .lean File' button and triggers downloadFile on click", () => {
    render(
      <VictoryModal
        score={{
          levelId: sampleLevel.id,
          completed: true,
          timestamp: 1700000000000,
          stars: 3,
          remainingRam: 10,
          morality: 100,
          usedSorry: false,
        }}
        level={sampleLevel}
        totalLevels={10}
        currentLevelIndex={0}
        leanCode="theorem rfl_demo : 1 = 1 := by rfl"
        onNextLevel={() => {}}
        onRestartLevel={() => {}}
      />
    );

    const downloadBtn = screen.getByRole("button", {
      name: /^Download \.lean File$/i,
    });
    expect(downloadBtn).toBeTruthy();

    fireEvent.click(downloadBtn);

    expect(downloadModule.downloadFile).toHaveBeenCalledWith(
      "theorem rfl_demo : 1 = 1 := by rfl",
      expect.stringMatching(/\.lean$/),
      expect.objectContaining({
        mimeType: expect.stringContaining("text/x-lean"),
      })
    );
  });
});

describe("LeanIdeInspector Export Actions", () => {
  const sampleLevel = puzzleLevels[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides download buttons for Lean source (.lean) and step log metadata (.json) with browserCheck", () => {
    render(
      <LeanIdeInspector level={sampleLevel} steps={[]} isComplete={true} />
    );

    const leanBtn = screen.getByRole("button", { name: /^Download \.lean$/i });
    const jsonBtn = screen.getByRole("button", {
      name: /^Export Step Log \(\.json\)$/i,
    });

    expect(leanBtn).toBeTruthy();
    expect(jsonBtn).toBeTruthy();

    fireEvent.click(leanBtn);
    expect(downloadModule.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining("theorem"),
      expect.stringMatching(/\.lean$/),
      expect.objectContaining({
        mimeType: expect.stringContaining("text/x-lean"),
      })
    );

    fireEvent.click(jsonBtn);
    expect(downloadModule.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('"browserCheck":'),
      expect.stringMatching(/_steplog\.json$/),
      expect.objectContaining({
        mimeType: expect.stringContaining("application/json"),
      })
    );
  });
});

describe("SandboxMode Custom Theorem Management", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves custom formulas to local storage, rejects duplicates, and respects 50 item capacity limit", () => {
    const res1 = saveCustomTheorem(
      "Formula 1",
      "(a + b)^2 = a^2 + 2*a*b + b^2"
    );
    expect(res1.success).toBe(true);
    expect(getSavedCustomTheorems()).toHaveLength(1);

    // Duplicate save attempt
    const resDup = saveCustomTheorem(
      "Formula 1 Dup",
      "(a + b)^2 = a^2 + 2*a*b + b^2"
    );
    expect(resDup.success).toBe(false);
    expect(resDup.error).toMatch(/already saved/i);
    expect(getSavedCustomTheorems()).toHaveLength(1);

    // Fill storage up to 50 items
    for (let i = 2; i <= 50; i++) {
      saveCustomTheorem(`Formula ${i}`, `a + ${i} = ${i} + a`);
    }
    expect(getSavedCustomTheorems()).toHaveLength(50);

    // 51st save should fail with capacity error
    const resOver = saveCustomTheorem("Formula 51", "x = y");
    expect(resOver.success).toBe(false);
    expect(resOver.error).toMatch(/storage capacity reached/i);
  });

  it("deletes custom theorems from local storage", () => {
    const res = saveCustomTheorem("To Delete", "p -> p");
    const id = res.theorems[0].id;

    const remaining = deleteCustomTheorem(id);
    expect(remaining).toHaveLength(0);
    expect(getSavedCustomTheorems()).toHaveLength(0);
  });

  it("validates and imports custom theorems JSON, assigning fresh IDs and skipping duplicates & invalid formulas", () => {
    saveCustomTheorem("Existing Theorem", "x = x");

    const validJson = JSON.stringify({
      version: "1.0",
      theorems: [
        {
          id: "foreign-id-1",
          title: "Existing Duplicate",
          formula: "x = x", // Duplicate of existing
        },
        {
          id: "foreign-id-2",
          title: "Valid Transitivity",
          formula: "a = c",
          hypotheses: "h1: a = b, h2: b = c",
        },
        {
          id: "foreign-id-3",
          title: "Broken Formula",
          formula: "a + * b", // Syntax error
        },
      ],
    });

    const res = importCustomTheorems(validJson);
    expect(res.success).toBe(true);
    expect(res.importedCount).toBe(1);
    expect(res.errors).toHaveLength(2); // 1 duplicate skipped, 1 broken formula skipped

    const saved = getSavedCustomTheorems();
    expect(saved).toHaveLength(2);
    const imported = saved.find((t) => t.title === "Valid Transitivity");
    expect(imported).toBeTruthy();
    expect(imported?.id).not.toBe("foreign-id-2"); // Fresh ID assigned
    expect(imported?.id).toMatch(/^custom-imp-/);
  });

  it("renders custom theorem drawer controls in SandboxMode UI", async () => {
    saveCustomTheorem("Test Saved Theorem", "x = x");

    render(<SandboxMode />);

    const drawerToggle = screen.getByRole("button", {
      name: /custom formula input/i,
    });
    fireEvent.click(drawerToggle);

    expect(screen.getByText(/saved theorems collection/i)).toBeTruthy();
    expect(screen.getByText(/test saved theorem/i)).toBeTruthy();

    const saveBtn = screen.getByRole("button", { name: /^Save Theorem$/i });
    const exportBtn = screen.getByRole("button", {
      name: /^Export All \(\.json\)$/i,
    });
    const importBtn = screen.getByRole("button", {
      name: /^Import \(\.json\)$/i,
    });

    expect(saveBtn).toBeTruthy();
    expect(exportBtn).toBeTruthy();
    expect(importBtn).toBeTruthy();

    fireEvent.click(exportBtn);
    expect(downloadModule.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('"version": "1.0"'),
      "custom_theorems.json",
      expect.objectContaining({
        mimeType: expect.stringContaining("application/json"),
      })
    );
  });
});
